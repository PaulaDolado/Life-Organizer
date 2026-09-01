import { prisma } from "../config/database";
import { addMinutes, addHours } from "date-fns";
import { nextOccurrenceStartingIn, EventExceptionLike } from "../utils/recurrence";
import { computeGoalRisk } from "./goalsService";
import { buildPagination } from "../utils/pagination";
import { ForbiddenError, NotFoundError } from "../utils/errorHandler";
import { logger } from "../utils/logger";

// Margen alrededor de cada antelación configurada (ver Event.reminderMinutesBefore): con el
// cron corriendo cada 5 min, ±5 min de margen garantiza que toda ocurrencia pase por la
// ventana exactamente una vez, sin huecos ni dobles disparos.
const REMINDER_WINDOW_MARGIN_MIN = 5;
// Cuánto hay que mirar hacia delante para no perderse la antelación más larga configurable
// (1 día = 1440 min); con margen de sobra para no recortar justo el caso límite.
const EVENT_REMINDER_LOOKAHEAD_HOURS = 25;
const TASK_DUE_WINDOW_HOURS = 24;

// Bucket "día natural" (UTC) usado para desduplicar avisos que, a diferencia de un recordatorio
// de evento, no tienen una ocurrencia concreta a la que enganchar `occurrenceAt` — ver
// createGoalRiskAlerts. Mismo criterio que streakService/habitsService para "el mismo día".
function startOfUtcDay(date: Date): Date {
  const copy = new Date(date);
  copy.setUTCHours(0, 0, 0, 0);
  return copy;
}

/** "Evento en 15 minutos" / "Evento en 1 hora" / "Evento en 1 día" — según la antelación configurada. */
function offsetLabel(minutes: number): string {
  if (minutes % 1440 === 0) {
    const days = minutes / 1440;
    return days === 1 ? "1 día" : `${days} días`;
  }
  if (minutes % 60 === 0) {
    const hours = minutes / 60;
    return hours === 1 ? "1 hora" : `${hours} horas`;
  }
  return `${minutes} minutos`;
}

interface ListNotificationsFilters {
  unreadOnly?: boolean;
  page?: number;
  limit?: number;
}

export async function listNotifications(userId: number, filters: ListNotificationsFilters = {}) {
  const page = filters.page ?? 1;
  const limit = filters.limit ?? 20;
  const where = { userId, ...(filters.unreadOnly ? { read: false } : {}) };

  const [notifications, total] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.notification.count({ where }),
  ]);

  return { notifications, pagination: buildPagination(page, limit, total) };
}

export async function getUnreadCount(userId: number) {
  const unreadCount = await prisma.notification.count({ where: { userId, read: false } });
  return { unreadCount };
}

async function findOwnedNotification(userId: number, id: number) {
  const notification = await prisma.notification.findUnique({ where: { id } });
  if (!notification) throw new NotFoundError("Notificación no encontrada");
  if (notification.userId !== userId) throw new ForbiddenError("No autorizado");
  return notification;
}

export async function markAsRead(userId: number, id: number) {
  await findOwnedNotification(userId, id);
  return prisma.notification.update({ where: { id }, data: { read: true } });
}

export async function markAllAsRead(userId: number) {
  const result = await prisma.notification.updateMany({ where: { userId, read: false }, data: { read: true } });
  return { updated: result.count };
}

export async function deleteNotification(userId: number, id: number) {
  await findOwnedNotification(userId, id);
  await prisma.notification.delete({ where: { id } });
}

/**
 * Revisa TODOS los eventos de TODOS los usuarios (no está scopeado a un userId — lo llama
 * el scheduler, no un endpoint) y crea una notificación "event_reminder" por cada antelación
 * configurada en `Event.reminderMinutesBefore` que caiga en su ventana ahora mismo (p.ej. un
 * evento con [15, 1440] puede generar dos avisos independientes para la misma ocurrencia: uno
 * 1 día antes y otro 15 min antes). Respeta las excepciones de eventos recurrentes — una
 * ocurrencia cancelada no genera aviso, una movida usa su horario nuevo (ver utils/recurrence.ts).
 *
 * Deduplicado por (type, relatedId=eventId, occurrenceAt, offsetMinutesBefore): el offset es
 * necesario porque dos antelaciones distintas de la MISMA ocurrencia comparten relatedId y
 * occurrenceAt — sin él, la segunda se descartaría como "duplicado" de la primera.
 */
export async function createEventReminders(now: Date = new Date()): Promise<number> {
  const lookaheadEnd = addHours(now, EVENT_REMINDER_LOOKAHEAD_HOURS);

  const [nonRecurring, recurringTemplates] = await Promise.all([
    prisma.event.findMany({
      where: { isRecurring: false, startTime: { gte: now, lte: lookaheadEnd }, reminderMinutesBefore: { isEmpty: false } },
    }),
    prisma.event.findMany({
      where: { isRecurring: true, startTime: { lte: lookaheadEnd }, reminderMinutesBefore: { isEmpty: false } },
    }),
  ]);

  const exceptionsByEventId = new Map<number, EventExceptionLike[]>();
  if (recurringTemplates.length > 0) {
    const exceptions = await prisma.eventException.findMany({
      where: { eventId: { in: recurringTemplates.map((t) => t.id) } },
    });
    for (const ex of exceptions) {
      const list = exceptionsByEventId.get(ex.eventId) ?? [];
      list.push(ex);
      exceptionsByEventId.set(ex.eventId, list);
    }
  }

  interface Candidate {
    userId: number;
    eventId: number;
    title: string;
    occurrenceAt: Date;
    offsetMinutes: number;
  }

  const candidates: Candidate[] = [];

  for (const event of nonRecurring) {
    const minutesUntilStart = (event.startTime.getTime() - now.getTime()) / 60000;
    for (const offset of event.reminderMinutesBefore) {
      if (Math.abs(minutesUntilStart - offset) <= REMINDER_WINDOW_MARGIN_MIN) {
        candidates.push({ userId: event.userId, eventId: event.id, title: event.title, occurrenceAt: event.startTime, offsetMinutes: offset });
      }
    }
  }

  for (const template of recurringTemplates) {
    const exceptions = exceptionsByEventId.get(template.id) ?? [];
    for (const offset of template.reminderMinutesBefore) {
      const windowStart = addMinutes(now, offset - REMINDER_WINDOW_MARGIN_MIN);
      const windowEnd = addMinutes(now, offset + REMINDER_WINDOW_MARGIN_MIN);
      const occurrence = nextOccurrenceStartingIn(template, windowStart, windowEnd, exceptions);
      if (occurrence) {
        candidates.push({
          userId: template.userId,
          eventId: template.id,
          title: template.title,
          occurrenceAt: occurrence.startTime,
          offsetMinutes: offset,
        });
      }
    }
  }

  if (candidates.length === 0) return 0;

  const existing = await prisma.notification.findMany({
    where: { type: "event_reminder", relatedId: { in: candidates.map((c) => c.eventId) } },
    select: { relatedId: true, occurrenceAt: true, offsetMinutesBefore: true },
  });
  const existingKeys = new Set(existing.map((n) => `${n.relatedId}-${n.occurrenceAt?.getTime()}-${n.offsetMinutesBefore}`));

  const toCreate = candidates.filter((c) => !existingKeys.has(`${c.eventId}-${c.occurrenceAt.getTime()}-${c.offsetMinutes}`));
  if (toCreate.length === 0) return 0;

  await prisma.notification.createMany({
    data: toCreate.map((c) => ({
      userId: c.userId,
      type: "event_reminder",
      title: `Evento en ${offsetLabel(c.offsetMinutes)}`,
      message: `"${c.title}" empieza a las ${c.occurrenceAt.toISOString()}`,
      relatedId: c.eventId,
      occurrenceAt: c.occurrenceAt,
      offsetMinutesBefore: c.offsetMinutes,
    })),
  });

  logger.info(`createEventReminders: ${toCreate.length} recordatorio(s) creado(s)`);
  return toCreate.length;
}

/**
 * Revisa todas las metas incompletas de todos los usuarios y crea una notificación
 * "goal_at_risk" para las que `computeGoalRisk` marca como en riesgo — como mucho UNA por
 * meta y día natural (UTC), sin importar si la de hoy ya se leyó o no.
 *
 * Antes desduplicaba solo por "sin leer": en cuanto el usuario la marcaba como leída (o
 * simplemente abría el panel de notificaciones, que las marca leídas), el siguiente tick del
 * cron (cada 5 min, ver notificationScheduler) volvía a crear otra si la meta seguía en
 * riesgo — y como "en riesgo" es un estado que normalmente no cambia de un tick a otro (el
 * ritmo de una meta semanal/mensual no varía en 5 minutos), el usuario podía recibir una
 * alerta nueva cada 5 minutos sin parar mientras no progresara en la meta. Al desduplicar por
 * día (occurrenceAt = inicio del día en vez de "sin leer"), la misma meta como mucho avisa una
 * vez al día — vuelve a avisar al día siguiente si sigue en riesgo, léase o no la de hoy.
 */
export async function createGoalRiskAlerts(now: Date = new Date()): Promise<number> {
  const incompleteGoals = await prisma.goal.findMany({ where: { completed: false } });
  const atRiskGoals = incompleteGoals.filter((g) => computeGoalRisk(g, now).atRisk);

  if (atRiskGoals.length === 0) return 0;

  const today = startOfUtcDay(now);
  const alertedToday = await prisma.notification.findMany({
    where: { type: "goal_at_risk", relatedId: { in: atRiskGoals.map((g) => g.id) }, occurrenceAt: today },
    select: { relatedId: true },
  });
  const alreadyAlertedToday = new Set(alertedToday.map((n) => n.relatedId));

  const toCreate = atRiskGoals.filter((g) => !alreadyAlertedToday.has(g.id));
  if (toCreate.length === 0) return 0;

  await prisma.notification.createMany({
    data: toCreate.map((g) => ({
      userId: g.userId,
      type: "goal_at_risk",
      title: "Meta en riesgo",
      message: `"${g.title}" va por detrás del ritmo necesario para completarse a tiempo.`,
      relatedId: g.id,
      occurrenceAt: today,
    })),
  });

  logger.info(`createGoalRiskAlerts: ${toCreate.length} alerta(s) creada(s)`);
  return toCreate.length;
}

/**
 * Revisa las tareas del Planificador (todos los usuarios) con `dueDate` fijada, no marcadas
 * "done", cuya fecha límite ya pasó o está a menos de `TASK_DUE_WINDOW_HOURS` — y crea una
 * notificación "task_due" para cada una. Igual que `createGoalRiskAlerts`, como mucho UNA por
 * tarea y día natural (UTC), sin importar si la de hoy ya se leyó o no.
 *
 * Antes desduplicaba solo por "sin leer": en cuanto el usuario la leía (o abría el panel de
 * notificaciones, que las marca leídas), el siguiente tick del cron (cada 5 min) volvía a crear
 * otra si la tarea seguía vencida/pendiente — spam cada 5 minutos. Al desduplicar por día
 * (occurrenceAt = inicio del día en vez de "sin leer"), la misma tarea como mucho avisa una vez
 * al día — vuelve a avisar al día siguiente si sigue vencida/pendiente, léase o no la de hoy.
 */
export async function createTaskDueReminders(now: Date = new Date()): Promise<number> {
  const windowEnd = addHours(now, TASK_DUE_WINDOW_HOURS);

  const dueSoonTasks = await prisma.task.findMany({
    where: { status: { not: "done" }, dueDate: { not: null, lte: windowEnd } },
  });

  if (dueSoonTasks.length === 0) return 0;

  const today = startOfUtcDay(now);
  const alertedToday = await prisma.notification.findMany({
    where: { type: "task_due", relatedId: { in: dueSoonTasks.map((t) => t.id) }, occurrenceAt: today },
    select: { relatedId: true },
  });
  const alreadyAlertedToday = new Set(alertedToday.map((n) => n.relatedId));

  const toCreate = dueSoonTasks.filter((t) => !alreadyAlertedToday.has(t.id));
  if (toCreate.length === 0) return 0;

  await prisma.notification.createMany({
    data: toCreate.map((t) => ({
      userId: t.userId,
      type: "task_due",
      title: t.dueDate! <= now ? "Tarea vencida" : "Tarea próxima a vencer",
      message: `"${t.title}" vence el ${t.dueDate!.toISOString()}`,
      relatedId: t.id,
      occurrenceAt: today,
    })),
  });

  logger.info(`createTaskDueReminders: ${toCreate.length} recordatorio(s) creado(s)`);
  return toCreate.length;
}
