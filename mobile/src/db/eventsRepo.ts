import { getDb } from "./index";
import { LocalEvent, ServerEvent } from "../types";

/** Solo caché de lectura (Fase 1 no crea/edita eventos desde el móvil) — un pull siempre
 * sobrescribe sin comprobar nada local. */
export async function upsertEvents(events: ServerEvent[]): Promise<void> {
  if (events.length === 0) return;
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    for (const e of events) {
      await db.runAsync(
        `INSERT OR REPLACE INTO events (id, title, type, startTime, endTime, location, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [e.id, e.title, e.type, e.startTime, e.endTime, e.location, e.updatedAt]
      );
    }
  });
}

export async function deleteEvent(id: number): Promise<void> {
  const db = await getDb();
  await db.runAsync("DELETE FROM events WHERE id = ?", [id]);
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function listTodayEvents(): Promise<LocalEvent[]> {
  const db = await getDb();
  const today = todayKey();
  return db.getAllAsync<LocalEvent>(
    "SELECT * FROM events WHERE date(startTime) = ? ORDER BY startTime ASC",
    [today]
  );
}
