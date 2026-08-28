import { getDb } from "./index";
import { LocalTask, ServerTask } from "../types";

/** Un pull nunca pisa una fila marcada `dirty` (cambio de estado hecho offline, aún no subido)
 * — se resolverá en el próximo push; sobrescribirla aquí perdería la edición local. En el flujo
 * normal (`runSync` sube antes de bajar, ver sync/index.ts) esto casi nunca se cruza, pero es la
 * red de seguridad si un pull se dispara solo (p.ej. arranque de la app antes del primer push). */
export async function upsertTasks(tasks: ServerTask[]): Promise<void> {
  if (tasks.length === 0) return;
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    for (const t of tasks) {
      await db.runAsync(
        `INSERT INTO tasks (id, title, status, dueDate, updatedAt, dirty) VALUES (?, ?, ?, ?, ?, 0)
         ON CONFLICT(id) DO UPDATE SET title = excluded.title, status = excluded.status,
           dueDate = excluded.dueDate, updatedAt = excluded.updatedAt
         WHERE tasks.dirty = 0`,
        [t.id, t.title, t.status, t.dueDate, t.updatedAt]
      );
    }
  });
}

export async function deleteTask(id: number): Promise<void> {
  const db = await getDb();
  await db.runAsync("DELETE FROM tasks WHERE id = ?", [id]);
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function listTasksDueToday(): Promise<LocalTask[]> {
  const db = await getDb();
  return db.getAllAsync<LocalTask>(
    "SELECT * FROM tasks WHERE date(dueDate) = ? ORDER BY updatedAt DESC",
    [todayKey()]
  );
}

/** Alterna entre "done" y "todo" (Fase 1 no expone el estado intermedio "in_progress" desde el
 * móvil — solo hecha/pendiente, más simple para un toggle de un solo toque). */
export async function toggleTaskDone(id: number): Promise<void> {
  const db = await getDb();
  const task = await db.getFirstAsync<LocalTask>("SELECT * FROM tasks WHERE id = ?", [id]);
  if (!task) return;
  const nextStatus = task.status === "done" ? "todo" : "done";
  await db.runAsync("UPDATE tasks SET status = ?, updatedAt = ?, dirty = 1 WHERE id = ?", [
    nextStatus,
    new Date().toISOString(),
    id,
  ]);
}

export async function listDirtyTasks(): Promise<LocalTask[]> {
  const db = await getDb();
  return db.getAllAsync<LocalTask>("SELECT * FROM tasks WHERE dirty = 1");
}

export async function clearTaskDirty(id: number): Promise<void> {
  const db = await getDb();
  await db.runAsync("UPDATE tasks SET dirty = 0 WHERE id = ?", [id]);
}
