import { prisma } from "../config/database";
import { parseDateParam, dayRange, weekRange } from "../utils/dateHelpers";
import { ForbiddenError, NotFoundError } from "../utils/errorHandler";

interface EventFilters {
  type?: string;
}

async function findEventsInRange(userId: number, start: Date, end: Date, filters: EventFilters) {
  return prisma.event.findMany({
    where: {
      userId,
      startTime: { gte: start },
      endTime: { lte: end },
      ...(filters.type ? { type: filters.type } : {}),
    },
    orderBy: { startTime: "asc" },
  });
}

export async function getDay(userId: number, dateStr: string, filters: EventFilters = {}) {
  const date = parseDateParam(dateStr);
  const { start, end } = dayRange(date);
  const events = await findEventsInRange(userId, start, end, filters);
  return { date: dateStr, events };
}

export async function getWeek(userId: number, dateStr: string, filters: EventFilters = {}) {
  const date = parseDateParam(dateStr);
  const { start, end } = weekRange(date);
  const events = await findEventsInRange(userId, start, end, filters);
  return { week: dateStr, weekStart: start, weekEnd: end, events };
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
