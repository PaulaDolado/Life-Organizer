import { prisma } from "../config/database";
import { buildPagination } from "../utils/pagination";
import { ForbiddenError, NotFoundError } from "../utils/errorHandler";

interface CreateHobbyInput {
  name: string;
  category: string;
  description?: string | null;
}

export async function createHobby(userId: number, input: CreateHobbyInput) {
  return prisma.hobby.create({
    data: {
      userId,
      name: input.name,
      category: input.category,
      description: input.description ?? null,
    },
  });
}

export async function listHobbies(userId: number, page = 1, limit = 20) {
  const where = { userId };
  const [hobbies, total] = await Promise.all([
    prisma.hobby.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * limit, take: limit }),
    prisma.hobby.count({ where }),
  ]);
  return { hobbies, pagination: buildPagination(page, limit, total) };
}

export async function listByCategory(userId: number, category: string, page = 1, limit = 20) {
  const where = { userId, category };
  const [hobbies, total] = await Promise.all([
    prisma.hobby.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * limit, take: limit }),
    prisma.hobby.count({ where }),
  ]);
  return { hobbies, pagination: buildPagination(page, limit, total) };
}

async function findOwnedHobby(userId: number, hobbyId: number) {
  const hobby = await prisma.hobby.findUnique({ where: { id: hobbyId } });
  if (!hobby) throw new NotFoundError("Hobby no encontrado");
  if (hobby.userId !== userId) throw new ForbiddenError("No autorizado");
  return hobby;
}

export async function updateHobby(userId: number, hobbyId: number, input: Partial<CreateHobbyInput>) {
  await findOwnedHobby(userId, hobbyId);

  return prisma.hobby.update({
    where: { id: hobbyId },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.category !== undefined ? { category: input.category } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
    },
  });
}

export async function deleteHobby(userId: number, hobbyId: number) {
  await findOwnedHobby(userId, hobbyId);
  await prisma.hobby.delete({ where: { id: hobbyId } });
}

interface CreateSessionInput {
  durationMinutes: number;
  date?: string | Date;
  notes?: string | null;
}

export async function addSession(userId: number, hobbyId: number, input: CreateSessionInput) {
  await findOwnedHobby(userId, hobbyId);

  return prisma.hobbySession.create({
    data: {
      hobbyId,
      userId,
      durationMinutes: input.durationMinutes,
      notes: input.notes ?? null,
      ...(input.date ? { date: new Date(input.date) } : {}),
    },
  });
}

export async function getHobbyAnalytics(userId: number, hobbyId: number) {
  await findOwnedHobby(userId, hobbyId);

  const [aggregate, recentSessions, totalSessions] = await Promise.all([
    prisma.hobbySession.aggregate({
      where: { hobbyId },
      _sum: { durationMinutes: true },
    }),
    prisma.hobbySession.findMany({
      where: { hobbyId },
      orderBy: { date: "desc" },
      take: 5,
    }),
    prisma.hobbySession.count({ where: { hobbyId } }),
  ]);

  const totalMinutes = aggregate._sum.durationMinutes ?? 0;

  return {
    hobbyId,
    totalSessions,
    totalMinutes,
    totalHours: Math.round((totalMinutes / 60) * 100) / 100,
    recentSessions,
  };
}
