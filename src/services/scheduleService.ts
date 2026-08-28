import { prisma } from "../config/database";
import { ForbiddenError, NotFoundError } from "../utils/errorHandler";

export async function listRows(userId: number) {
  const rows = await prisma.scheduleRow.findMany({
    where: { userId },
    orderBy: { order: "asc" },
  });
  return { rows };
}

export async function addRow(userId: number, timeLabel?: string) {
  const last = await prisma.scheduleRow.findFirst({ where: { userId }, orderBy: { order: "desc" } });
  return prisma.scheduleRow.create({
    data: {
      userId,
      timeLabel: timeLabel?.trim() ?? "",
      order: (last?.order ?? -1) + 1,
    },
  });
}

async function findOwnedRow(userId: number, rowId: number) {
  const row = await prisma.scheduleRow.findUnique({ where: { id: rowId } });
  if (!row) throw new NotFoundError("Fila del horario no encontrada");
  if (row.userId !== userId) throw new ForbiddenError("No autorizado");
  return row;
}

interface UpdateRowInput {
  timeLabel?: string;
  monday?: string;
  tuesday?: string;
  wednesday?: string;
  thursday?: string;
  friday?: string;
}

export async function updateRow(userId: number, rowId: number, input: UpdateRowInput) {
  await findOwnedRow(userId, rowId);
  return prisma.scheduleRow.update({
    where: { id: rowId },
    data: {
      ...(input.timeLabel !== undefined ? { timeLabel: input.timeLabel } : {}),
      ...(input.monday !== undefined ? { monday: input.monday } : {}),
      ...(input.tuesday !== undefined ? { tuesday: input.tuesday } : {}),
      ...(input.wednesday !== undefined ? { wednesday: input.wednesday } : {}),
      ...(input.thursday !== undefined ? { thursday: input.thursday } : {}),
      ...(input.friday !== undefined ? { friday: input.friday } : {}),
    },
  });
}

export async function deleteRow(userId: number, rowId: number) {
  await findOwnedRow(userId, rowId);
  await prisma.scheduleRow.delete({ where: { id: rowId } });
}

// Intercambia el `order` con la fila inmediatamente anterior/siguiente (dentro de las filas del
// propio usuario, ordenadas) — así "subir"/"bajar" una fila es un simple swap de dos valores,
// sin tener que renumerar todas las filas de por medio.
export async function moveRow(userId: number, rowId: number, direction: "up" | "down") {
  const row = await findOwnedRow(userId, rowId);
  const neighbor = await prisma.scheduleRow.findFirst({
    where: {
      userId,
      order: direction === "up" ? { lt: row.order } : { gt: row.order },
    },
    orderBy: { order: direction === "up" ? "desc" : "asc" },
  });
  if (!neighbor) return; // ya está en el extremo — no hay nada que intercambiar

  await prisma.$transaction([
    prisma.scheduleRow.update({ where: { id: row.id }, data: { order: neighbor.order } }),
    prisma.scheduleRow.update({ where: { id: neighbor.id }, data: { order: row.order } }),
  ]);
}
