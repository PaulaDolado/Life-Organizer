import { startOfDay, endOfDay, startOfWeek, endOfWeek, isValid, parseISO } from "date-fns";

/** Parsea una fecha en formato YYYY-MM-DD (o ISO) y valida que sea correcta. */
export function parseDateParam(dateStr: string): Date {
  const parsed = parseISO(dateStr);
  if (!isValid(parsed)) {
    throw new Error(`Fecha inválida: ${dateStr}`);
  }
  return parsed;
}

export function dayRange(date: Date): { start: Date; end: Date } {
  return { start: startOfDay(date), end: endOfDay(date) };
}

/** Semana empieza en lunes (convención europea, coherente con timezone por defecto "Europe/Madrid"). */
export function weekRange(date: Date): { start: Date; end: Date } {
  return {
    start: startOfWeek(date, { weekStartsOn: 1 }),
    end: endOfWeek(date, { weekStartsOn: 1 }),
  };
}
