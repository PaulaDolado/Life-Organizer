import { prisma } from "../config/database";

// Por categoría — una búsqueda global orienta hacia dónde ir, no sustituye el listado
// paginado de cada sección, así que un puñado de resultados por tipo basta.
const RESULT_LIMIT = 8;

/**
 * Búsqueda global entre eventos, tareas, notas y proyectos del usuario — `contains` insensible
 * a mayúsculas sobre título/descripción (y ubicación en eventos), sin motor de texto completo:
 * a la escala de una agenda personal no hace falta más, y evita añadir una dependencia solo
 * para esto.
 */
export async function search(userId: number, query: string) {
  const q = query.trim();
  if (!q) {
    return { query: q, events: [], tasks: [], notes: [], projects: [] };
  }

  const insensitive = { contains: q, mode: "insensitive" as const };

  const [events, tasks, notes, projects] = await Promise.all([
    prisma.event.findMany({
      where: { userId, OR: [{ title: insensitive }, { description: insensitive }, { location: insensitive }] },
      take: RESULT_LIMIT,
      orderBy: { startTime: "desc" },
      select: { id: true, title: true, startTime: true, isRecurring: true },
    }),
    prisma.task.findMany({
      where: { userId, OR: [{ title: insensitive }, { description: insensitive }] },
      take: RESULT_LIMIT,
      orderBy: { createdAt: "desc" },
      select: { id: true, title: true, status: true },
    }),
    prisma.note.findMany({
      where: { userId, content: insensitive },
      take: RESULT_LIMIT,
      orderBy: { createdAt: "desc" },
      select: { id: true, content: true },
    }),
    prisma.project.findMany({
      where: { userId, OR: [{ title: insensitive }, { description: insensitive }] },
      take: RESULT_LIMIT,
      orderBy: { createdAt: "desc" },
      select: { id: true, title: true, status: true },
    }),
  ]);

  return { query: q, events, tasks, notes, projects };
}
