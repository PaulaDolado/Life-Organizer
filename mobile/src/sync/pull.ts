import { api } from "../api/client";
import { getCursor, setCursor } from "../db/syncMeta";
import { upsertEvents, deleteEvent } from "../db/eventsRepo";
import { upsertTasks, deleteTask } from "../db/tasksRepo";
import { upsertNotes, deleteNoteByServerId } from "../db/notesRepo";
import { upsertHabits, upsertHabitLogs, deleteHabit, deleteHabitLogByServerId } from "../db/habitsRepo";
import { PullResponse } from "../types";

/** Descarga lo cambiado desde el último cursor guardado (o bootstrap completo la primera vez) y
 * lo aplica a SQLite: upsert de lo creado/editado, borrado de lo que trae tombstone. El cursor
 * nuevo (`serverTime`) solo se guarda al final, si todo lo anterior tuvo éxito — si algo falla a
 * mitad, el próximo intento vuelve a pedir desde el mismo punto (idempotente: un upsert/delete
 * repetido no hace daño). */
export async function pullFromServer(): Promise<void> {
  const since = await getCursor();
  const query = since ? `?since=${encodeURIComponent(since)}` : "";
  const response = await api.get<PullResponse>(`/sync/pull${query}`);

  await upsertEvents(response.events);
  await upsertTasks(response.tasks);
  await upsertNotes(response.notes);
  await upsertHabits(response.habits);
  await upsertHabitLogs(response.habitLogs);

  for (const tombstone of response.tombstones) {
    switch (tombstone.entityType) {
      case "event":
        await deleteEvent(tombstone.entityId);
        break;
      case "task":
        await deleteTask(tombstone.entityId);
        break;
      case "note":
        await deleteNoteByServerId(tombstone.entityId);
        break;
      case "habit":
        await deleteHabit(tombstone.entityId);
        break;
      case "habitLog":
        await deleteHabitLogByServerId(tombstone.entityId);
        break;
      // "eventException" y "subtask" no se cachean en esta fase — se ignoran.
    }
  }

  await setCursor(response.serverTime);
}
