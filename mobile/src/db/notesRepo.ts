import * as Crypto from "expo-crypto";
import { getDb } from "./index";
import { LocalNote, ServerNote } from "../types";

/** Igual criterio que en tasksRepo/habitsRepo: no se pisa una nota con una operación local
 * pendiente (`pendingOp`) — se resolverá con el próximo push. Una nota `synced = 0` (creada
 * offline, aún sin id de servidor) tampoco puede llegar nunca por un pull, así que no hace
 * falta contemplarla aquí. */
export async function upsertNotes(notes: ServerNote[]): Promise<void> {
  if (notes.length === 0) return;
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    for (const n of notes) {
      const id = String(n.id);
      await db.runAsync(
        `INSERT INTO notes (id, content, checked, createdAt, updatedAt, synced, pendingOp)
         VALUES (?, ?, ?, ?, ?, 1, NULL)
         ON CONFLICT(id) DO UPDATE SET content = excluded.content, checked = excluded.checked,
           updatedAt = excluded.updatedAt, synced = 1
         WHERE notes.pendingOp IS NULL`,
        [id, n.content, n.checked ? 1 : 0, n.createdAt, n.updatedAt]
      );
    }
  });
}

export async function deleteNoteByServerId(serverId: number): Promise<void> {
  const db = await getDb();
  await db.runAsync("DELETE FROM notes WHERE id = ? AND synced = 1", [String(serverId)]);
}

/** Excluye las marcadas para borrar (borrado optimista: desaparecen de la UI al instante, el
 * push real las quita de la BD en cuanto el servidor confirma — ver sync/push.ts). */
export async function listNotes(): Promise<LocalNote[]> {
  const db = await getDb();
  return db.getAllAsync<LocalNote>(
    "SELECT * FROM notes WHERE pendingOp IS NULL OR pendingOp != 'delete' ORDER BY createdAt ASC"
  );
}

export async function createNoteLocal(content: string): Promise<void> {
  const db = await getDb();
  const now = new Date().toISOString();
  await db.runAsync(
    "INSERT INTO notes (id, content, checked, createdAt, updatedAt, synced, pendingOp) VALUES (?, ?, 0, ?, ?, 0, NULL)",
    [Crypto.randomUUID(), content, now, now]
  );
}

export async function toggleNoteChecked(id: string): Promise<void> {
  const db = await getDb();
  const note = await db.getFirstAsync<LocalNote>("SELECT * FROM notes WHERE id = ?", [id]);
  if (!note) return;
  const now = new Date().toISOString();
  await db.runAsync(
    `UPDATE notes SET checked = ?, updatedAt = ?, pendingOp = CASE WHEN synced = 1 THEN 'update' ELSE pendingOp END
     WHERE id = ?`,
    [note.checked ? 0 : 1, now, id]
  );
}

/** Una nota nunca sincronizada se borra sin más (nada que decirle al servidor); una ya
 * sincronizada se marca para borrar y desaparece de `listNotes` de inmediato, pero la fila
 * sigue existiendo hasta que el push confirma el borrado — ver sync/push.ts. */
export async function deleteNoteLocal(id: string): Promise<void> {
  const db = await getDb();
  const note = await db.getFirstAsync<LocalNote>("SELECT * FROM notes WHERE id = ?", [id]);
  if (!note) return;
  if (note.synced === 0) {
    await db.runAsync("DELETE FROM notes WHERE id = ?", [id]);
  } else {
    await db.runAsync("UPDATE notes SET pendingOp = 'delete' WHERE id = ?", [id]);
  }
}

export async function listUnsyncedNotes(): Promise<LocalNote[]> {
  const db = await getDb();
  return db.getAllAsync<LocalNote>("SELECT * FROM notes WHERE synced = 0");
}

export async function listNotesPendingUpdate(): Promise<LocalNote[]> {
  const db = await getDb();
  return db.getAllAsync<LocalNote>("SELECT * FROM notes WHERE synced = 1 AND pendingOp = 'update'");
}

export async function listNotesPendingDelete(): Promise<LocalNote[]> {
  const db = await getDb();
  return db.getAllAsync<LocalNote>("SELECT * FROM notes WHERE pendingOp = 'delete'");
}

/** Sustituye el id local (uuid) por el real del servidor tras un push con éxito — la fila sigue
 * siendo "la misma" para SQLite porque `id` es una columna de texto normal, no un alias del
 * rowid (ver schema.ts). */
export async function markNoteSynced(localId: string, serverId: number): Promise<void> {
  const db = await getDb();
  await db.runAsync("UPDATE notes SET id = ?, synced = 1 WHERE id = ?", [String(serverId), localId]);
}

export async function clearNotePendingOp(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync("UPDATE notes SET pendingOp = NULL WHERE id = ?", [id]);
}

export async function deleteNoteRow(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync("DELETE FROM notes WHERE id = ?", [id]);
}
