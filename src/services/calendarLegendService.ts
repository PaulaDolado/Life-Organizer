import { prisma } from "../config/database";
import { ForbiddenError, NotFoundError } from "../utils/errorHandler";

// ---------------------------------------------------------------------------------------------
// Categorías de la leyenda (ver AnnualCalendarLegend en el dashboard) — compartidas para toda la
// cuenta, no por horario/trimestre.
// ---------------------------------------------------------------------------------------------

export async function listCategories(userId: number) {
  const categories = await prisma.calendarLegendCategory.findMany({
    where: { userId },
    orderBy: { order: "asc" },
  });
  return { categories };
}

export async function createCategory(userId: number, label: string, color: string) {
  const last = await prisma.calendarLegendCategory.findFirst({ where: { userId }, orderBy: { order: "desc" } });
  return prisma.calendarLegendCategory.create({
    data: { userId, label: label.trim(), color, order: (last?.order ?? -1) + 1 },
  });
}

async function findOwnedCategory(userId: number, categoryId: number) {
  const category = await prisma.calendarLegendCategory.findUnique({ where: { id: categoryId } });
  if (!category) throw new NotFoundError("Categoría no encontrada");
  if (category.userId !== userId) throw new ForbiddenError("No autorizado");
  return category;
}

interface UpdateCategoryInput {
  label?: string;
  color?: string;
  order?: number;
}

export async function updateCategory(userId: number, categoryId: number, input: UpdateCategoryInput) {
  await findOwnedCategory(userId, categoryId);
  return prisma.calendarLegendCategory.update({
    where: { id: categoryId },
    data: {
      ...(input.label !== undefined ? { label: input.label.trim() } : {}),
      ...(input.color !== undefined ? { color: input.color } : {}),
      ...(input.order !== undefined ? { order: input.order } : {}),
    },
  });
}

// Borrar una categoría borra en cascada (ver schema.prisma) las marcas de día que la usaban —
// esos días simplemente vuelven a quedar sin pintar en el calendario, no hace falta más lógica.
export async function deleteCategory(userId: number, categoryId: number) {
  await findOwnedCategory(userId, categoryId);
  await prisma.calendarLegendCategory.delete({ where: { id: categoryId } });
}

// ---------------------------------------------------------------------------------------------
// Días pintados (ver comentario en schema.prisma: un día por fila, no un rango).
// ---------------------------------------------------------------------------------------------

export async function listMarks(userId: number, from: string, to: string) {
  const marks = await prisma.calendarDayMark.findMany({
    where: { userId, date: { gte: new Date(from), lte: new Date(to) } },
    select: { date: true, categoryId: true },
    orderBy: { date: "asc" },
  });
  return { marks: marks.map((m) => ({ date: m.date.toISOString().slice(0, 10), categoryId: m.categoryId })) };
}

// `categoryId: null` borra la marca de ese día; si no, la crea o la reemplaza por la nueva
// categoría (pintar encima de un día ya pintado sustituye el color, no lo acumula).
export async function setDayMark(userId: number, dateStr: string, categoryId: number | null) {
  const date = new Date(dateStr);

  if (categoryId === null) {
    await prisma.calendarDayMark.deleteMany({ where: { userId, date } });
    return { date: dateStr, categoryId: null };
  }

  await findOwnedCategory(userId, categoryId);
  await prisma.calendarDayMark.upsert({
    where: { userId_date: { userId, date } },
    create: { userId, categoryId, date },
    update: { categoryId },
  });
  return { date: dateStr, categoryId };
}
