import { prisma } from "../config/database";
import { addMinutes } from "date-fns";
import { nextOccurrenceStartingIn } from "../utils/recurrence";
import { computeGoalRisk } from "./goalsService";
import { buildPagination } from "../utils/pagination";
import { ForbiddenError, NotFoundError } from "../utils/errorHandler";
import { logger } from "../utils/logger";

const REMINDER_WINDOW_BEFORE_MIN = 25;
const REMINDER_WINDOW_AFTER_MIN = 35;

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
 * el scheduler, no un endpoint) y crea una notificación "event_reminder" para cada ocurrencia
 * (real o recurrente-virtual, ver utils/recurrence.ts) que empiece entre 25 y 35 minutos a
 * partir de `now`. Deduplicado por (type, relatedId=eventId, occurrenceAt=startTime de esa
 * ocurrencia concreta) para no re-notificar en cada tick del cron (corre cada 5 min, así que
 * sin dedup se dispararía ~2 veces por ocurrencia).
 */
export async function createEventReminders(now: Date = new Date()): Promise<number> {
  const windowStart = addMinutes(now, REMINDER_WINDOW_BEFORE_MIN);
  const windowEnd = addMinutes(now, REMINDER_WINDOW_AFTER_MIN);

  const [nonRecurring, recurringTemplates] = await Promise.all([
    prisma.event.findMany({
      where: { isRecurring: false, startTime: { gte: windowStart, lte: windowEnd } },
    }),
    prisma.event.findMany({
      where: { isRecurring: true, startTime: { lte: windowEnd } },
    }),
  ]);

  interface Candidate {
    userId: number;
    eventId: number;
    title: string;
    occurrenceAt: Date;
  }

  const candidates: Candidate[] = nonRecurring.map((e) => ({
    userId: e.userId,
    eventId: e.id,
    title: e.title,
    occurrenceAt: e.startTime,
  }));

  for (const template of recurringTemplates) {
    const occurrence = nextOccurrenceStartingIn(template, windowStart, windowEnd);
    if (occurrence) {
      candidates.push({
        userId: template.userId,
        eventId: template.id,
        title: template.title,
        occurrenceAt: occurrence.startTime,
      });
    }
  }

  if (candidates.length === 0) return 0;

  const existing = await prisma.notification.findMany({
    where: { type: "event_reminder", relatedId: { in: candidates.map((c) => c.eventId) } },
    select: { relatedId: true, occurrenceAt: true },
  });
  const existingKeys = new Set(existing.map((n) => `${n.relatedId}-${n.occurrenceAt?.getTime()}`));

  const toCreate = candidates.filter((c) => !existingKeys.has(`${c.eventId}-${c.occurrenceAt.getTime()}`));
  if (toCreate.length === 0) return 0;

  await prisma.notification.createMany({
    data: toCreate.map((c) => ({
      userId: c.userId,
      type: "event_reminder",
      title: "Evento en 30 minutos",
      message: `"${c.title}" empieza a las ${c.occurrenceAt.toISOString()}`,
      relatedId: c.eventId,
      occurrenceAt: c.occurrenceAt,
    })),
  });

  logger.info(`createEventReminders: ${toCreate.length} recordatorio(s) creado(s)`);
  return toCreate.length;
}

/**
 * Revisa todas las metas incompletas de todos los usuarios y crea una notificación
 * "goal_at_risk" para las que `computeGoalRisk` marca como en riesgo. No re-crea una
 * alerta para la misma meta mientras ya haya una sin leer (evita spam cada 5 minutos
 * mientras la meta siga en riesgo) — una vez el usuario la lee, puede volver a dispararse
 * en el siguiente tick si sigue en riesgo.
 */
export async function createGoalRiskAlerts(now: Date = new Date()): Promise<number> {
  const incompleteGoals = await prisma.goal.findMany({ where: { completed: false } });
  const atRiskGoals = incompleteGoals.filter((g) => computeGoalRisk(g, now).atRisk);

  if (atRiskGoals.length === 0) return 0;

  const existingUnread = await prisma.notification.findMany({
    where: { type: "goal_at_risk", relatedId: { in: atRiskGoals.map((g) => g.id) }, read: false },
    select: { relatedId: true },
  });
  const alreadyAlerted = new Set(existingUnread.map((n) => n.relatedId));

  const toCreate = atRiskGoals.filter((g) => !alreadyAlerted.has(g.id));
  if (toCreate.length === 0) return 0;

  await prisma.notification.createMany({
    data: toCreate.map((g) => ({
      userId: g.userId,
      type: "goal_at_risk",
      title: "Meta en riesgo",
      message: `"${g.title}" va por detrás del ritmo necesario para completarse a tiempo.`,
      relatedId: g.id,
    })),
  });

  logger.info(`createGoalRiskAlerts: ${toCreate.length} alerta(s) creada(s)`);
  return toCreate.length;
}
