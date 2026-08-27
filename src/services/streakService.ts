import { prisma } from "../config/database";

function dateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function utcMidnight(daysAgo = 0): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - daysAgo);
  return d;
}

// Límite de seguridad: no hace falta mirar más de un año atrás para una racha realista, y evita
// un bucle largo si por lo que sea el usuario tiene hábitos/tareas desde hace mucho tiempo.
const LOOKBACK_DAYS = 365;

/**
 * Racha combinada: días CONSECUTIVOS (empezando hoy hacia atrás) en los que se cumplieron TODOS
 * los hábitos activos (marcados ese día) Y se completaron todas las tareas del Planificador con
 * `dueDate` ese día — extiende el concepto de racha de hábitos (ver habitsService.listHabits)
 * uniéndolo con las tareas vencidas del día.
 *
 * Un día sin hábitos activos NI tareas con vencimiento se SALTA (no cuenta ni rompe la racha —
 * no hay nada que evaluar ese día); un día con algo pendiente sin completar SÍ la rompe. Sin
 * este salto, una cuenta nueva sin hábitos ni tareas fechadas mostraría una racha de cientos de
 * días por pura vacuidad, lo cual sería engañoso.
 */
export async function computeCombinedStreak(userId: number): Promise<{ streak: number; sinceDate: string | null }> {
  const since = utcMidnight(LOOKBACK_DAYS - 1);

  const [activeHabits, habitLogs, dueTasks] = await Promise.all([
    prisma.habit.findMany({ where: { userId, active: true }, select: { id: true, createdAt: true } }),
    prisma.habitLog.findMany({ where: { userId, date: { gte: since } }, select: { habitId: true, date: true } }),
    prisma.task.findMany({ where: { userId, dueDate: { gte: since } }, select: { dueDate: true, status: true } }),
  ]);

  const loggedByDay = new Map<string, Set<number>>();
  for (const log of habitLogs) {
    const key = dateKey(log.date);
    const set = loggedByDay.get(key) ?? new Set<number>();
    set.add(log.habitId);
    loggedByDay.set(key, set);
  }

  const tasksByDay = new Map<string, { total: number; done: number }>();
  for (const task of dueTasks) {
    if (!task.dueDate) continue;
    const key = dateKey(task.dueDate);
    const entry = tasksByDay.get(key) ?? { total: 0, done: 0 };
    entry.total += 1;
    if (task.status === "done") entry.done += 1;
    tasksByDay.set(key, entry);
  }

  let streak = 0;
  let sinceDate: string | null = null;
  const cursor = utcMidnight();

  for (let daysScanned = 0; daysScanned < LOOKBACK_DAYS; daysScanned += 1) {
    const key = dateKey(cursor);
    const endOfDay = cursor.getTime() + 24 * 60 * 60 * 1000 - 1;

    const habitsThatDay = activeHabits.filter((h) => h.createdAt.getTime() <= endOfDay);
    const loggedThatDay = loggedByDay.get(key) ?? new Set<number>();
    const allHabitsDone = habitsThatDay.every((h) => loggedThatDay.has(h.id));

    const taskSummary = tasksByDay.get(key);
    const allTasksDone = !taskSummary || taskSummary.done === taskSummary.total;

    const somethingToTrack = habitsThatDay.length > 0 || !!taskSummary;

    if (somethingToTrack) {
      if (!allHabitsDone || !allTasksDone) break;
      streak += 1;
      sinceDate = key;
    }

    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }

  return { streak, sinceDate };
}
