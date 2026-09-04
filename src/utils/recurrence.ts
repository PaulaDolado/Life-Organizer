import { addWeeks, addMonths } from "date-fns";
// Import de submódulo, no del barrel "date-fns": por alguna razón (posible colisión de export *
// en su index.d.ts con moduleResolution "node") tsc no reconoce `addDays` como miembro exportado
// del paquete completo, aunque sí funciona en runtime y aunque el resto de funciones de esta
// misma importación (addWeeks, addMonths) resuelven bien desde el barrel. El submódulo evita el
// problema del todo: está declarado explícitamente en el "exports" de date-fns/package.json.
import { addDays } from "date-fns/addDays";

export interface RecurringEventLike {
  id: number;
  isRecurring: boolean;
  recurringPattern: string | null;
  startTime: Date;
  endTime: Date;
  // Solo con recurringPattern = "weekday_range" — ver el comentario de estos campos en
  // prisma/schema.prisma.
  recurringWeekdayStart?: number | null;
  recurringWeekdayEnd?: number | null;
}

/** Excepción a una ocurrencia concreta — ver comentario de `EventException` en el schema. */
export interface EventExceptionLike {
  originalStartTime: Date;
  status: string; // "moved" | "cancelled"
  newStartTime?: Date | null;
  newEndTime?: Date | null;
}

export interface EventOccurrence<T> {
  event: T;
  startTime: Date;
  endTime: Date;
  isRecurringInstance: boolean;
  seriesId: number;
  // Presentes solo cuando la ocurrencia tiene una EventException aplicada: `originalStartTime`
  // es el horario "natural" (sin excepción) — lo necesita el cliente para poder crear/editar
  // la excepción de esta ocurrencia concreta (identificador estable, ver schema).
  originalStartTime?: Date;
  isException?: boolean;
  exceptionStatus?: "moved";
}

/** Límite de seguridad: nunca generar más de N ocurrencias en una sola expansión,
 * aunque el rango pedido fuera absurdamente amplio (evita loops largos con datos raros).
 * Calibrado para la cadencia más fina ("daily"): ~10 años a razón de una ocurrencia por día.
 * Con cadencias más espaciadas (weekly/biweekly/monthly) el propio rango de fechas corta el
 * bucle mucho antes en la práctica, así que un límite pensado para "daily" no les afecta. */
const MAX_OCCURRENCES = 3660; // ~10 años en cadencia diaria

/**
 * Calcula la ocurrencia número `n` (0 = la original) SIEMPRE a partir de `originalStart`,
 * nunca encadenando desde la ocurrencia anterior. Esto importa para "monthly": si se
 * encadenara (n → n+1 a partir del resultado ya calculado), un evento anclado el día 31
 * quedaría "clampado" a 28 en febrero y ya nunca volvería a 31 en marzo — un date-fns
 * `addMonths` calculado siempre desde el mes original evita ese arrastre.
 *
 * "weekday_range" avanza día a día, igual que "daily": no hay una cadencia semanal/mensual que
 * calcular aquí, cada día es un candidato — qué días concretos producen una ocurrencia visible
 * lo decide `matchesWeekdayRange` en el bucle de `expandRecurringEvent`/`nextOccurrenceStartingIn`.
 */
function occurrenceAt(originalStart: Date, pattern: string, n: number): Date {
  switch (pattern) {
    case "daily":
    case "weekday_range":
      return addDays(originalStart, n);
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

/** 1=lunes .. 7=domingo (ISO) — `Date.getDay()` da 0=domingo..6=sábado, hay que rotarlo. */
function isoWeekday(date: Date): number {
  const day = date.getDay();
  return day === 0 ? 7 : day;
}

/** ¿Cae `date` dentro de [start, end] (ambos inclusive, convención ISO)? Si `start > end` el
 * rango da la vuelta a la semana (p.ej. 5 a 1 = viernes, sábado, domingo, lunes) — así un rango
 * "hacia atrás" sigue siendo válido en vez de no coincidir nunca. */
function matchesWeekdayRange(date: Date, start: number, end: number): boolean {
  const weekday = isoWeekday(date);
  if (start <= end) return weekday >= start && weekday <= end;
  return weekday >= start || weekday <= end;
}

/** Si el patrón es "weekday_range", ¿es `naturalStart` uno de los días que le tocan? Para el
 * resto de patrones siempre es true — cada `naturalStart` que calcula `occurrenceAt` ya es, por
 * definición, un día válido de esa cadencia. */
function matchesRecurrencePattern<T extends RecurringEventLike>(event: T, naturalStart: Date): boolean {
  if (event.recurringPattern !== "weekday_range") return true;
  return matchesWeekdayRange(naturalStart, event.recurringWeekdayStart ?? 1, event.recurringWeekdayEnd ?? 5);
}

function findException(exceptions: EventExceptionLike[], naturalStart: Date): EventExceptionLike | undefined {
  return exceptions.find((ex) => ex.originalStartTime.getTime() === naturalStart.getTime());
}

/**
 * Expande un evento recurrente (la fila "plantilla" guardada en BD) en sus ocurrencias
 * virtuales dentro de [rangeStart, rangeEnd]. No se materializan filas nuevas en la BD:
 * la plantilla sigue siendo la única fuente de verdad para la cadencia — pero una ocurrencia
 * individual puede tener una `EventException` (mover/cancelar solo esa, ver `exceptions`)
 * sin afectar al resto de la serie.
 *
 * Si el evento no es recurrente, retorna [] — el llamador debe incluir el evento tal cual
 * por separado.
 */
export function expandRecurringEvent<T extends RecurringEventLike>(
  event: T,
  rangeStart: Date,
  rangeEnd: Date,
  exceptions: EventExceptionLike[] = []
): EventOccurrence<T>[] {
  if (!event.isRecurring || !event.recurringPattern) return [];

  const durationMs = event.endTime.getTime() - event.startTime.getTime();
  const occurrences: EventOccurrence<T>[] = [];

  let n = 0;
  let cursorStart = event.startTime;

  while (cursorStart.getTime() <= rangeEnd.getTime() && n < MAX_OCCURRENCES) {
    const naturalStart = cursorStart;

    if (matchesRecurrencePattern(event, naturalStart)) {
      const exception = findException(exceptions, naturalStart);

      if (!exception || exception.status !== "cancelled") {
        const moved = exception?.status === "moved";
        const effectiveStart = moved && exception?.newStartTime ? exception.newStartTime : naturalStart;
        const effectiveEnd =
          moved && exception?.newEndTime ? exception.newEndTime : new Date(naturalStart.getTime() + durationMs);

        if (effectiveStart.getTime() >= rangeStart.getTime() && effectiveEnd.getTime() <= rangeEnd.getTime()) {
          occurrences.push({
            event,
            startTime: effectiveStart,
            endTime: effectiveEnd,
            isRecurringInstance: true,
            seriesId: event.id,
            // Siempre presente (no solo cuando hay excepción): el cliente lo necesita para poder
            // crear la PRIMERA excepción de una ocurrencia que hasta ahora era "natural".
            originalStartTime: naturalStart,
            ...(exception ? { isException: true, exceptionStatus: "moved" as const } : {}),
          });
        }
      }
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
 *
 * Respeta `exceptions` igual que `expandRecurringEvent`: una ocurrencia cancelada nunca se
 * devuelve (no debe generar recordatorio), y una movida devuelve su horario nuevo.
 */
export function nextOccurrenceStartingIn<T extends RecurringEventLike>(
  event: T,
  rangeStart: Date,
  rangeEnd: Date,
  exceptions: EventExceptionLike[] = []
): EventOccurrence<T> | null {
  if (!event.isRecurring || !event.recurringPattern) return null;

  const durationMs = event.endTime.getTime() - event.startTime.getTime();
  let n = 0;
  let cursorStart = event.startTime;

  while (cursorStart.getTime() <= rangeEnd.getTime() && n < MAX_OCCURRENCES) {
    const naturalStart = cursorStart;

    if (matchesRecurrencePattern(event, naturalStart)) {
      const exception = findException(exceptions, naturalStart);

      if (!exception || exception.status !== "cancelled") {
        const moved = exception?.status === "moved";
        const effectiveStart = moved && exception?.newStartTime ? exception.newStartTime : naturalStart;

        if (effectiveStart.getTime() >= rangeStart.getTime() && effectiveStart.getTime() <= rangeEnd.getTime()) {
          const effectiveEnd =
            moved && exception?.newEndTime ? exception.newEndTime : new Date(naturalStart.getTime() + durationMs);
          return {
            event,
            startTime: effectiveStart,
            endTime: effectiveEnd,
            isRecurringInstance: true,
            seriesId: event.id,
            originalStartTime: naturalStart,
            ...(exception ? { isException: true, exceptionStatus: "moved" as const } : {}),
          };
        }
      }
    }

    n += 1;
    cursorStart = occurrenceAt(event.startTime, event.recurringPattern, n);
  }

  return null;
}
