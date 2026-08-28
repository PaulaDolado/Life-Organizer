import { api } from "../api/client";
import { listDirtyTasks, clearTaskDirty } from "../db/tasksRepo";
import { listPendingHabitLogs, confirmHabitLogCreated, confirmHabitLogDeleted } from "../db/habitsRepo";
import {
  listUnsyncedNotes,
  listNotesPendingUpdate,
  listNotesPendingDelete,
  markNoteSynced,
  clearNotePendingOp,
  deleteNoteRow,
} from "../db/notesRepo";
import { PushResult } from "../types";

/** Sube todo lo pendiente en un único lote (mismo contrato que `syncService.push` en el
 * backend — ver API.md). Fase 1 solo genera tres tipos de cambio local: tareas marcadas
 * hecha/pendiente, hábitos marcados/desmarcados hoy, y notas rápidas (crear/editar/borrar) —
 * eventos y hábitos en sí son de solo lectura desde el móvil. */
export async function pushToServer(): Promise<void> {
  const [dirtyTasks, pendingLogs, newNotes, updatedNotes, deletedNotes] = await Promise.all([
    listDirtyTasks(),
    listPendingHabitLogs(),
    listUnsyncedNotes(),
    listNotesPendingUpdate(),
    listNotesPendingDelete(),
  ]);

  const hasChanges = dirtyTasks.length || pendingLogs.length || newNotes.length || updatedNotes.length || deletedNotes.length;
  if (!hasChanges) return;

  const habitLogCreates = pendingLogs.filter((l) => l.pending === "create").map((l) => ({ habitId: l.habitId, date: l.date }));
  const habitLogDeletes = pendingLogs
    .filter((l) => l.pending === "delete")
    .map((l) => ({ entityType: "habitLog" as const, habitId: l.habitId, date: l.date }));

  const body = {
    tasks: {
      update: dirtyTasks.map((t) => ({ id: t.id, clientUpdatedAt: t.updatedAt, status: t.status })),
    },
    notes: {
      create: newNotes.map((n) => ({ localId: n.id, content: n.content, checked: n.checked === 1 })),
      update: updatedNotes.map((n) => ({ id: Number(n.id), clientUpdatedAt: n.updatedAt, content: n.content, checked: n.checked === 1 })),
    },
    habitLogs: { create: habitLogCreates },
    deletes: [
      ...deletedNotes.filter((n) => n.synced === 1).map((n) => ({ entityType: "note" as const, id: Number(n.id) })),
      ...habitLogDeletes,
    ],
  };

  const result = await api.post<PushResult>("/sync/push", body);

  // Nada que hacer con `conflicts` aquí: la fila local ya se descartó en el servidor, y el
  // siguiente pull trae de vuelta la versión autoritativa — no hace falta reconciliar a mano.
  await Promise.all(dirtyTasks.map((t) => clearTaskDirty(t.id)));
  await Promise.all(habitLogCreates.map((l) => confirmHabitLogCreated(l.habitId, l.date)));
  await Promise.all(habitLogDeletes.map((l) => confirmHabitLogDeleted(l.habitId, l.date)));
  await Promise.all(updatedNotes.map((n) => clearNotePendingOp(n.id)));
  await Promise.all(deletedNotes.filter((n) => n.synced === 1).map((n) => deleteNoteRow(n.id)));
  // Las notas nunca sincronizadas (synced=0) ya se habían borrado localmente sin más al
  // borrarlas (ver notesRepo.deleteNoteLocal) — nunca llegan hasta aquí en `deletedNotes`.

  for (const mapping of result.idMappings) {
    if (mapping.entityType !== "note") continue;
    await markNoteSynced(mapping.localId, mapping.id);
  }
}
