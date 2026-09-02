import { getDb } from "./index";
import { LocalEventException, ServerEventException } from "../types";

/** Solo caché de lectura (el móvil no crea/edita excepciones en esta fase, ver
 * mobile/README.md) — un pull siempre sobrescribe sin comprobar nada local, igual que
 * `eventsRepo` hacía en Fase 1 para los propios eventos. Se identifican por
 * (eventId, originalStartTime), no por su `id` de servidor (igual que en el propio backend, ver
 * `EventException` en prisma/schema.prisma). */
export async function upsertEventExceptions(exceptions: ServerEventException[]): Promise<void> {
  if (exceptions.length === 0) return;
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    for (const ex of exceptions) {
      await db.runAsync(
        `INSERT OR REPLACE INTO event_exceptions
           (eventId, originalStartTime, serverId, status, newStartTime, newEndTime, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [String(ex.eventId), ex.originalStartTime, ex.id, ex.status, ex.newStartTime, ex.newEndTime, ex.updatedAt]
      );
    }
  });
}

export async function deleteEventExceptionByServerId(serverId: number): Promise<void> {
  const db = await getDb();
  await db.runAsync("DELETE FROM event_exceptions WHERE serverId = ?", [serverId]);
}

export async function listExceptionsForEvents(eventIds: string[]): Promise<LocalEventException[]> {
  if (eventIds.length === 0) return [];
  const db = await getDb();
  const placeholders = eventIds.map(() => "?").join(",");
  return db.getAllAsync<LocalEventException>(`SELECT * FROM event_exceptions WHERE eventId IN (${placeholders})`, eventIds);
}
