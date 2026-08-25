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
