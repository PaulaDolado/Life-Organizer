import { isValid } from "date-fns";
import { fromZonedTime } from "date-fns-tz";
import { isValidTimezone } from "./timezone";

// Generación y parseo de iCalendar (RFC 5545), a mano — igual que utils/recurrence.ts, sin
// depender de una librería externa para algo que solo necesitamos en dos direcciones muy
// concretas: exportar los eventos propios y aceptar un .ics ajeno con fidelidad razonable
// (no hace falta implementar el estándar entero, solo lo que Google Calendar/Outlook producen
// y consumen en la práctica).

function pad(n: number, width = 2): string {
  return String(n).padStart(width, "0");
}

/** Instante UTC → "YYYYMMDDTHHMMSSZ" (DATE-TIME en UTC, RFC 5545 §3.3.5). */
function formatIcsDate(d: Date): string {
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
  );
}

/** Escapa un valor de texto ICS: backslash, punto y coma, coma y salto de línea (RFC 5545 §3.3.11). */
function escapeIcsText(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

function unescapeIcsText(text: string): string {
  return text.replace(/\\n/gi, "\n").replace(/\\,/g, ",").replace(/\\;/g, ";").replace(/\\\\/g, "\\");
}

/** Pliega una línea a un máximo de 75 octetos con continuación indentada (RFC 5545 §3.1) —
 * algunos clientes truncan o rechazan líneas más largas (p.ej. una DESCRIPTION extensa). */
function foldLine(line: string): string {
  const MAX = 75;
  if (line.length <= MAX) return line;
  let result = line.slice(0, MAX);
  let rest = line.slice(MAX);
  while (rest.length > 0) {
    result += `\r\n ${rest.slice(0, MAX - 1)}`;
    rest = rest.slice(MAX - 1);
  }
  return result;
}

const PATTERN_TO_RRULE: Record<string, string> = {
  weekly: "FREQ=WEEKLY",
  biweekly: "FREQ=WEEKLY;INTERVAL=2",
  monthly: "FREQ=MONTHLY",
};

const UID_DOMAIN = "life-organizer.local";

export interface IcsExceptionLike {
  originalStartTime: Date;
  status: string; // "moved" | "cancelled"
  newStartTime?: Date | null;
  newEndTime?: Date | null;
}

export interface IcsEventInput {
  id: number;
  title: string;
  description?: string | null;
  location?: string | null;
  startTime: Date;
  endTime: Date;
  isRecurring: boolean;
  recurringPattern?: string | null;
  exceptions?: IcsExceptionLike[];
}

/**
 * Genera un .ics con un VEVENT por evento. Los recurrentes llevan RRULE (mapeado desde
 * weekly/biweekly/monthly) y, si tienen excepciones, EXDATE para las canceladas y un VEVENT
 * adicional con RECURRENCE-ID para cada movida — así Google Calendar/Outlook entienden que
 * sustituye a esa ocurrencia concreta de la serie, no que es un evento nuevo suelto.
 */
export function buildIcs(events: IcsEventInput[]): string {
  const lines: string[] = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Life Organizer//Agenda//ES", "CALSCALE:GREGORIAN"];
  const stamp = formatIcsDate(new Date());

  for (const event of events) {
    const uid = `event-${event.id}@${UID_DOMAIN}`;

    lines.push("BEGIN:VEVENT");
    lines.push(foldLine(`UID:${uid}`));
    lines.push(`DTSTAMP:${stamp}`);
    lines.push(`DTSTART:${formatIcsDate(event.startTime)}`);
    lines.push(`DTEND:${formatIcsDate(event.endTime)}`);
    lines.push(foldLine(`SUMMARY:${escapeIcsText(event.title)}`));
    if (event.description) lines.push(foldLine(`DESCRIPTION:${escapeIcsText(event.description)}`));
    if (event.location) lines.push(foldLine(`LOCATION:${escapeIcsText(event.location)}`));

    if (event.isRecurring && event.recurringPattern) {
      const rrule = PATTERN_TO_RRULE[event.recurringPattern];
      if (rrule) lines.push(`RRULE:${rrule}`);

      const cancelled = (event.exceptions ?? []).filter((ex) => ex.status === "cancelled");
      if (cancelled.length > 0) {
        lines.push(foldLine(`EXDATE:${cancelled.map((ex) => formatIcsDate(ex.originalStartTime)).join(",")}`));
      }
    }

    lines.push("END:VEVENT");

    for (const ex of (event.exceptions ?? []).filter((e) => e.status === "moved" && e.newStartTime && e.newEndTime)) {
      lines.push("BEGIN:VEVENT");
      lines.push(foldLine(`UID:${uid}`));
      lines.push(`DTSTAMP:${stamp}`);
      lines.push(`RECURRENCE-ID:${formatIcsDate(ex.originalStartTime)}`);
      lines.push(`DTSTART:${formatIcsDate(ex.newStartTime as Date)}`);
      lines.push(`DTEND:${formatIcsDate(ex.newEndTime as Date)}`);
      lines.push(foldLine(`SUMMARY:${escapeIcsText(event.title)}`));
      lines.push("END:VEVENT");
    }
  }

  lines.push("END:VCALENDAR");
  return lines.join("\r\n") + "\r\n";
}

export interface ParsedIcsEvent {
  title: string;
  description: string | null;
  location: string | null;
  startTime: Date;
  endTime: Date;
  isRecurring: boolean;
  recurringPattern: string | null;
  // RRULE presente pero no mapeable a weekly/biweekly/monthly (p.ej. FREQ=DAILY, o BYDAY
  // complejo): se importa como evento único (solo la primera ocurrencia), no se descarta.
  unsupportedRecurrence: boolean;
}

function unfoldLines(raw: string): string[] {
  const rawLines = raw.split(/\r\n|\n|\r/);
  const lines: string[] = [];
  for (const line of rawLines) {
    if ((line.startsWith(" ") || line.startsWith("\t")) && lines.length > 0) {
      lines[lines.length - 1] += line.slice(1);
    } else if (line.length > 0) {
      lines.push(line);
    }
  }
  return lines;
}

function parseLine(line: string): { key: string; params: Record<string, string>; value: string } {
  const colonIndex = line.indexOf(":");
  const head = colonIndex === -1 ? line : line.slice(0, colonIndex);
  const value = colonIndex === -1 ? "" : line.slice(colonIndex + 1);
  const [key, ...paramParts] = head.split(";");
  const params: Record<string, string> = {};
  for (const part of paramParts) {
    const [pk, pv] = part.split("=");
    if (pk && pv) params[pk.toUpperCase()] = pv;
  }
  return { key: (key ?? "").toUpperCase(), params, value };
}

/** "20260824T160000Z" (UTC) o "20260824T180000" con TZID opcional (hora de pared en esa zona,
 * o en `fallbackTimezone` si no hay TZID o no es una zona reconocida). */
function parseIcsDateTime(value: string, params: Record<string, string>, fallbackTimezone: string): Date | null {
  const match = value.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z)?$/);
  if (!match) return null;
  const [, y, mo, d, h, mi, s, z] = match;
  if (z) {
    const utc = new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s)));
    return isValid(utc) ? utc : null;
  }
  const timezone = params.TZID && isValidTimezone(params.TZID) ? params.TZID : fallbackTimezone;
  const zoned = fromZonedTime(`${y}-${mo}-${d} ${h}:${mi}:${s}`, timezone);
  return isValid(zoned) ? zoned : null;
}

type IcsFields = Record<string, { params: Record<string, string>; value: string }>;

function buildEventFromFields(fields: IcsFields, fallbackTimezone: string): ParsedIcsEvent | null {
  // Una VEVENT con RECURRENCE-ID es la excepción "movida" de otra serie del propio archivo —
  // importarla como evento independiente la duplicaría con la serie base. Se ignora: el import
  // es best-effort, no reconstruye excepciones (ver comentario del módulo).
  if (fields["RECURRENCE-ID"]) return null;

  const dtstart = fields.DTSTART;
  if (!dtstart) return null;
  const startTime = parseIcsDateTime(dtstart.value, dtstart.params, fallbackTimezone);
  if (!startTime) return null;

  const dtend = fields.DTEND;
  const parsedEnd = dtend ? parseIcsDateTime(dtend.value, dtend.params, fallbackTimezone) : null;
  const endTime = parsedEnd ?? new Date(startTime.getTime() + 60 * 60 * 1000); // sin DTEND: 1h por defecto

  const title = fields.SUMMARY ? unescapeIcsText(fields.SUMMARY.value) : "(Sin título)";
  const description = fields.DESCRIPTION ? unescapeIcsText(fields.DESCRIPTION.value) : null;
  const location = fields.LOCATION ? unescapeIcsText(fields.LOCATION.value) : null;

  let isRecurring = false;
  let recurringPattern: string | null = null;
  let unsupportedRecurrence = false;

  if (fields.RRULE) {
    const parts: Record<string, string> = {};
    for (const part of fields.RRULE.value.split(";")) {
      const [k, v] = part.split("=");
      if (k && v) parts[k.toUpperCase()] = v;
    }
    const freq = parts.FREQ;
    const interval = Number(parts.INTERVAL ?? "1");
    if (freq === "WEEKLY" && interval === 1) {
      isRecurring = true;
      recurringPattern = "weekly";
    } else if (freq === "WEEKLY" && interval === 2) {
      isRecurring = true;
      recurringPattern = "biweekly";
    } else if (freq === "MONTHLY" && interval === 1) {
      isRecurring = true;
      recurringPattern = "monthly";
    } else {
      unsupportedRecurrence = true;
    }
  }

  return { title, description, location, startTime, endTime, isRecurring, recurringPattern, unsupportedRecurrence };
}

/**
 * Parsea un .ics en eventos importables. No reconstruye EXDATE/RECURRENCE-ID como excepciones
 * (ver `buildEventFromFields`) ni VALARM — un import "best-effort" pensado para traer eventos
 * de Google/Outlook, no para round-trip perfecto con lo que exporta `buildIcs`.
 * `skipped` cuenta bloques VEVENT que no se pudieron interpretar (sin DTSTART válido, etc.).
 */
export function parseIcs(raw: string, fallbackTimezone: string): { events: ParsedIcsEvent[]; skipped: number } {
  const lines = unfoldLines(raw);
  const events: ParsedIcsEvent[] = [];
  let skipped = 0;
  let current: IcsFields | null = null;

  for (const rawLine of lines) {
    const { key, params, value } = parseLine(rawLine);
    if (key === "BEGIN" && value === "VEVENT") {
      current = {};
      continue;
    }
    if (key === "END" && value === "VEVENT") {
      if (current) {
        const event = buildEventFromFields(current, fallbackTimezone);
        if (event) events.push(event);
        else skipped += 1;
      }
      current = null;
      continue;
    }
    if (current) {
      current[key] = { params, value };
    }
  }

  return { events, skipped };
}
