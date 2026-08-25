import { prisma } from "../config/database";
import { parseDateParam, dayRange, weekRange } from "../utils/dateHelpers";
import { expandRecurringEvent } from "../utils/recurrence";
import { buildPagination } from "../utils/pagination";
import { safeTimezone } from "../utils/timezone";
import { ForbiddenError, NotFoundError } from "../utils/errorHandler";

/**
 * El "día de hoy" o "esta semana" depende de la zona horaria del usuario, no de dónde esté
 * desplegado el servidor — sin esto, un servidor en UTC calcularía los límites del día/semana
 * desalineados con la hora real del usuario (p.ej. Europe/Madrid en verano va 2h por delante).
 */
async function getUserTimezone(userId: number): Promise<string> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { timezone: true } });
  return safeTimezone(user?.timezone);
}

interface EventFilters {
  type?: string;
  page?: number;
  limit?: number;
}

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 50;

/**
 * Eventos dentro de [start, end]: los no recurrentes se consultan directo, y los
 * recurrentes se expanden en memoria a partir de la fila "plantilla" (ver utils/recurrence.ts).
 * No hay límite natural de fila-por-fila en BD para los recurrentes porque no se
 * materializan — por eso la paginación se aplica en memoria, después de mezclar y ordenar
 * ambos conjuntos.
 */
async function findEventsInRange(userId: number, start: Date, end: Date, filters: EventFilters) {
  const typeFilter = filters.type ? { type: filters.type } : {};

  const [nonRecurring, recurringTemplates] = await Promise.all([
    prisma.event.findMany({
      where: { userId, isRecurring: false, startTime: { gte: start }, endTime: { lte: end }, ...typeFilter },
    }),
    prisma.event.findMany({
      where: { userId, isRecurring: true, startTime: { lte: end }, ...typeFilter },
    }),
  ]);

  const virtualOccurrences = recurringTemplates.flatMap((template) =>
    expandRecurringEvent(template, start, end).map((occurrence) => ({
      ...template,
      startTime: occurrence.startTime,
      endTime: occurrence.endTime,
      isRecurringInstance: true,
    }))
  );

  const allEvents = [...nonRecurring.map((e) => ({ ...e, isRecurringInstance: false })), ...virtualOccurrences];
  allEvents.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());

  const page = filters.page ?? DEFAULT_PAGE;
  const limit = filters.limit ?? DEFAULT_LIMIT;
  const startIndex = (page - 1) * limit;
  const events = allEvents.slice(startIndex, startIndex + limit);

  return { events, pagination: buildPagination(page, limit, allEvents.length) };
}

export async function getDay(userId: number, dateStr: string, filters: EventFilters = {}) {
  parseDateParam(dateStr);
  const timezone = await getUserTimezone(userId);
  const { start, end } = dayRange(dateStr, timezone);
  const { events, pagination } = await findEventsInRange(userId, start, end, filters);
  return { date: dateStr, timezone, events, pagination };
}

export async function getWeek(userId: number, dateStr: string, filters: EventFilters = {}) {
  parseDateParam(dateStr);
  const timezone = await getUserTimezone(userId);
  const { start, end } = weekRange(dateStr, timezone);
  const { events, pagination } = await findEventsInRange(userId, start, end, filters);
  return { week: dateStr, weekStart: start, weekEnd: end, timezone, events, pagination };
}

interface CreateEventInput {
  title: string;
  description?: string | null;
  type: string;
  startTime: string | Date;
  endTime: string | Date;
  location?: string | null;
  isRecurring?: boolean;
  recurringPattern?: string | null;
}

export async function createEvent(userId: number, input: CreateEventInput) {
  return prisma.event.create({
    data: {
      userId,
      title: input.title,
      description: input.description ?? null,
      type: input.type,
      startTime: new Date(input.startTime),
      endTime: new Date(input.endTime),
      location: input.location ?? null,
      isRecurring: input.isRecurring ?? false,
      recurringPattern: input.recurringPattern ?? null,
    },
  });
}

async function assertOwnership(userId: number, eventId: number) {
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) {
    throw new NotFoundError("Evento no encontrado");
  }
  if (event.userId !== userId) {
    throw new ForbiddenError("No autorizado");
  }
  return event;
}

export async function updateEvent(userId: number, eventId: number, input: Partial<CreateEventInput>) {
  await assertOwnership(userId, eventId);

  return prisma.event.update({
    where: { id: eventId },
    data: {
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.type !== undefined ? { type: input.type } : {}),
      ...(input.startTime !== undefined ? { startTime: new Date(input.startTime) } : {}),
      ...(input.endTime !== undefined ? { endTime: new Date(input.endTime) } : {}),
      ...(input.location !== undefined ? { location: input.location } : {}),
      ...(input.isRecurring !== undefined ? { isRecurring: input.isRecurring } : {}),
      ...(input.recurringPattern !== undefined ? { recurringPattern: input.recurringPattern } : {}),
    },
  });
}

export async function deleteEvent(userId: number, eventId: number) {
  await assertOwnership(userId, eventId);
  await prisma.event.delete({ where: { id: eventId } });
}
