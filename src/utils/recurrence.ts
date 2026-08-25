import { addWeeks, addMonths } from "date-fns";

export interface RecurringEventLike {
  id: number;
  isRecurring: boolean;
  recurringPattern: string | null;
  startTime: Date;
  endTime: Date;
}

export interface EventOccurrence<T> {
  event: T;
  startTime: Date;
  endTime: Date;
  isRecurringInstance: boolean;
  seriesId: number;
}

/** Límite de seguridad: nunca generar más de N ocurrencias en una sola expansión,
 * aunque el rango pedido fuera absurdamente amplio (evita loops largos con datos raros). */
const MAX_OCCURRENCES = 520; // ~10 años en cadencia semanal

/**
 * Calcula la ocurrencia número `n` (0 = la original) SIEMPRE a partir de `originalStart`,
 * nunca encadenando desde la ocurrencia anterior. Esto importa para "monthly": si se
 * encadenara (n → n+1 a partir del resultado ya calculado), un evento anclado el día 31
 * quedaría "clampado" a 28 en febrero y ya nunca volvería a 31 en marzo — un date-fns
 * `addMonths` calculado siempre desde el mes original evita ese arrastre.
 */
function occurrenceAt(originalStart: Date, pattern: string, n: number): Date {
  switch (pattern) {
    case "weekly":
      return addWeeks(originalStart, n);
    case "biweekly":
      return addWeeks(originalStart, n * 2);
    case "monthly":
      return addMonths(originalStart, n);
    default:
      return addWeeks(originalStart, n);
  }
}

/**
 * Expande un evento recurrente (la fila "plantilla" guardada en BD) en sus ocurrencias
 * virtuales dentro de [rangeStart, rangeEnd]. No se materializan filas nuevas en la BD:
 * la plantilla sigue siendo la única fuente de verdad, y editarla/borrarla afecta a toda
 * la serie (no hay excepciones por ocurrencia individual, ver README).
 *
 * Si el evento no es recurrente, retorna [] — el llamador debe incluir el evento tal cual
 * por separado.
 */
export function expandRecurringEvent<T extends RecurringEventLike>(
  event: T,
  rangeStart: Date,
  rangeEnd: Date
): EventOccurrence<T>[] {
  if (!event.isRecurring || !event.recurringPattern) return [];

  const durationMs = event.endTime.getTime() - event.startTime.getTime();
  const occurrences: EventOccurrence<T>[] = [];

  let n = 0;
  let cursorStart = event.startTime;

  while (cursorStart.getTime() <= rangeEnd.getTime() && n < MAX_OCCURRENCES) {
    const cursorEnd = new Date(cursorStart.getTime() + durationMs);

    if (cursorStart.getTime() >= rangeStart.getTime() && cursorEnd.getTime() <= rangeEnd.getTime()) {
      occurrences.push({
        event,
        startTime: cursorStart,
        endTime: cursorEnd,
        isRecurringInstance: true,
        seriesId: event.id,
      });
    }

    n += 1;
    cursorStart = occurrenceAt(event.startTime, event.recurringPattern, n);
  }

  return occurrences;
}

/**
 * Pensado para el scheduler de recordatorios: "¿hay una ocurrencia de este evento cuyo
 * INICIO cae en este rango?" — a diferencia de `expandRecurringEvent`, que exige que la
 * ocurrencia COMPLETA (inicio y fin) quepa en el rango. Esa exigencia tiene sentido para
 * vistas de agenda (rango = un día/semana, mucho más ancho que la duración típica de un
 * evento) pero no para una ventana de recordatorio de ~10 minutos: un evento de 1 hora
 * jamás "cabría entero" ahí, aunque su inicio caiga justo en el centro de la ventana.
 */
export function nextOccurrenceStartingIn<T extends RecurringEventLike>(
  event: T,
  rangeStart: Date,
  rangeEnd: Date
): EventOccurrence<T> | null {
  if (!event.isRecurring || !event.recurringPattern) return null;

  const durationMs = event.endTime.getTime() - event.startTime.getTime();
  let n = 0;
  let cursorStart = event.startTime;

  while (cursorStart.getTime() <= rangeEnd.getTime() && n < MAX_OCCURRENCES) {
    if (cursorStart.getTime() >= rangeStart.getTime()) {
      return {
        event,
        startTime: cursorStart,
        endTime: new Date(cursorStart.getTime() + durationMs),
        isRecurringInstance: true,
        seriesId: event.id,
      };
    }

    n += 1;
    cursorStart = occurrenceAt(event.startTime, event.recurringPattern, n);
  }

  return null;
}
