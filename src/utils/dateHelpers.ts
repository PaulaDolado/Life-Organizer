import { isValid, parseISO } from "date-fns";
import { fromZonedTime } from "date-fns-tz";

/** Valida que una fecha en formato YYYY-MM-DD sea una fecha de calendario real (p.ej. rechaza 2026-02-30). */
export function parseDateParam(dateStr: string): void {
  if (!isValid(parseISO(dateStr))) {
    throw new Error(`Fecha inválida: ${dateStr}`);
  }
}

/**
 * Construye el instante UTC exacto para `${dateStr} ${timeStr}` interpretado como hora de
 * pared EN `timezone` — NO en la zona del servidor. Por ejemplo, "2026-08-24 00:00:00" en
 * "Europe/Madrid" (UTC+2 en verano) da como resultado 2026-08-23T22:00:00.000Z.
 *
 * Se pasa como string (no como Date ya construido) para evitar que el propio parseo de
 * `new Date(...)` de JS aplique de entrada la zona del servidor antes de que podamos
 * reinterpretarlo — `fromZonedTime` necesita los componentes numéricos "en crudo".
 */
function zonedInstant(dateStr: string, timeStr: string, timezone: string): Date {
  return fromZonedTime(`${dateStr} ${timeStr}`, timezone);
}

/** Fecha de calendario (Y-M-D) `daysOffset` días después de `dateStr`. Aritmética pura de
 * calendario en UTC — el día de la semana de una fecha no depende de ninguna zona horaria real. */
function shiftDateStr(dateStr: string, daysOffset: number): string {
  const anchor = new Date(`${dateStr}T00:00:00.000Z`);
  anchor.setUTCDate(anchor.getUTCDate() + daysOffset);
  return anchor.toISOString().slice(0, 10);
}

/** 0=domingo..6=sábado (getUTCDay estándar) para la fecha de calendario `dateStr`. */
function calendarWeekday(dateStr: string): number {
  return new Date(`${dateStr}T00:00:00.000Z`).getUTCDay();
}

/**
 * Qué fecha de calendario (Y-M-D) es "hoy" AHORA MISMO en `timezone` — a diferencia del resto
 * de helpers de este módulo (que parten de un `dateStr` ya dado), esta calcula el propio
 * `dateStr` a partir del instante actual. La usa `todayService` para saber qué día es "hoy"
 * para el usuario, no para el servidor (mismo motivo que `getUserTimezone` en agendaService).
 */
export function todayInTimezone(timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(
    new Date()
  );
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** Rango [00:00:00.000, 23:59:59.999] del día `dateStr`, como se entiende en `timezone`. */
export function dayRange(dateStr: string, timezone: string): { start: Date; end: Date } {
  return {
    start: zonedInstant(dateStr, "00:00:00.000", timezone),
    end: zonedInstant(dateStr, "23:59:59.999", timezone),
  };
}

/**
 * Rango [lunes 00:00:00.000, domingo 23:59:59.999] de la semana que contiene `dateStr`,
 * como se entiende en `timezone`. Semana empieza en lunes (convención europea).
 */
export function weekRange(dateStr: string, timezone: string): { start: Date; end: Date } {
  const weekday = calendarWeekday(dateStr); // 0=domingo..6=sábado
  const isoWeekday = weekday === 0 ? 7 : weekday; // 1=lunes..7=domingo
  const mondayStr = shiftDateStr(dateStr, -(isoWeekday - 1));
  const sundayStr = shiftDateStr(mondayStr, 6);

  return {
    start: zonedInstant(mondayStr, "00:00:00.000", timezone),
    end: zonedInstant(sundayStr, "23:59:59.999", timezone),
  };
}

/** Primer y último día de calendario (Y-M-D) del mes que contiene `dateStr`. Aritmética pura
 * de calendario en UTC, igual que `shiftDateStr` — el mes de una fecha no depende de ninguna
 * zona horaria real. */
function calendarMonthBounds(dateStr: string): { firstStr: string; lastStr: string } {
  const d = new Date(`${dateStr}T00:00:00.000Z`);
  const first = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)); // día 0 del mes siguiente = último día de este
  return { firstStr: first.toISOString().slice(0, 10), lastStr: last.toISOString().slice(0, 10) };
}

/** Rango [día 1 00:00:00.000, último día 23:59:59.999] del mes que contiene `dateStr`,
 * como se entiende en `timezone`. */
export function monthRange(dateStr: string, timezone: string): { start: Date; end: Date } {
  const { firstStr, lastStr } = calendarMonthBounds(dateStr);
  return {
    start: zonedInstant(firstStr, "00:00:00.000", timezone),
    end: zonedInstant(lastStr, "23:59:59.999", timezone),
  };
}

/**
 * Ventana horaria de un día concreto en `timezone` (por defecto 08:00–22:00 "de pared") — la
 * usa `agendaService.getFreeTime` como límites del día para calcular huecos: fuera de esta
 * franja no tiene sentido sugerir meter una tarea (de madrugada, por ejemplo).
 */
export function dayWorkWindow(
  dateStr: string,
  timezone: string,
  startHHMM: string = "08:00",
  endHHMM: string = "22:00"
): { start: Date; end: Date } {
  return {
    start: zonedInstant(dateStr, `${startHHMM}:00.000`, timezone),
    end: zonedInstant(dateStr, `${endHHMM}:00.000`, timezone),
  };
}
