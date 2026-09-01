import { prisma } from "../config/database";
import * as agendaService from "./agendaService";
import * as plannerService from "./plannerService";
import * as notesService from "./notesService";
import * as habitsService from "./habitsService";
import { logger } from "../utils/logger";

const EPOCH = new Date(0);

/**
 * Sincronización offline (Fase 1 — ver plan): Event/EventException, Task/Subtask, Note,
 * Habit/HabitLog. El resto de módulos (Finanzas, Proyectos, Galería, Objetivos,
 * Notificaciones) no sincroniza con el móvil todavía.
 *
 * Pull y push son deliberadamente EXPLÍCITOS por tipo (no un bucle genérico sobre los 7
 * modelos): cada uno tiene una firma de servicio distinta (`addSubtask(userId, taskId, title)`
 * no es `createEvent(userId, input)`), y ocultar eso detrás de una abstracción genérica
 * costaría más claridad de la que ahorra. Toda la lógica de negocio (validación, ownership) se
 * reutiliza de agendaService/plannerService/notesService/habitsService — esta capa solo
 * orquesta: qué tocó desde cuándo, y cómo aplicar un lote de cambios hechos offline.
 */

/**
 * Todo lo cambiado (creado o editado) para el usuario desde `since`, más los tombstones de lo
 * borrado — `serverTime` es el instante en que se hizo esta consulta, y es lo que el cliente
 * debe guardar como su próximo cursor (no el `updatedAt` máximo de las filas devueltas, que
 * podría quedar por detrás de escrituras concurrentes justo durante la consulta).
 */
export async function pull(userId: number, since?: Date) {
  const cursor = since ?? EPOCH;
  const serverTime = new Date();

  const [events, eventExceptions, tasks, subtasks, notes, habits, habitLogs, tombstones] = await Promise.all([
    prisma.event.findMany({ where: { userId, updatedAt: { gt: cursor } } }),
    prisma.eventException.findMany({ where: { event: { userId }, updatedAt: { gt: cursor } } }),
    prisma.task.findMany({ where: { userId, updatedAt: { gt: cursor } } }),
    prisma.subtask.findMany({ where: { task: { userId }, updatedAt: { gt: cursor } } }),
    prisma.note.findMany({ where: { userId, updatedAt: { gt: cursor } } }),
    prisma.habit.findMany({ where: { userId, updatedAt: { gt: cursor } } }),
    // HabitLog nunca se edita in-place (solo alta/baja, ver habitsService.toggleHabitDay) —
    // `createdAt` ya es un cursor de "nuevo desde" válido, no hace falta `updatedAt`.
    prisma.habitLog.findMany({ where: { userId, createdAt: { gt: cursor } } }),
    prisma.syncTombstone.findMany({ where: { userId, deletedAt: { gt: cursor } } }),
  ]);

  return { serverTime, events, eventExceptions, tasks, subtasks, notes, habits, habitLogs, tombstones };
}

interface ConflictInfo {
  entityType: string;
  id: number;
}

interface IdMapping {
  entityType: string;
  localId: string;
  id: number;
}

export interface PushResult {
  idMappings: IdMapping[];
  conflicts: ConflictInfo[];
}

/**
 * Aplica una edición offline solo si es más reciente que la del servidor (last-write-wins) —
 * adecuado porque estos datos son de un único usuario entre sus propios dispositivos, no
 * colaborativos entre personas. `fetchCurrent` debe devolver `null` si la fila ya no existe o
 * no es del usuario (tratado igual que "no hay nada que actualizar", no como error — pudo
 * borrarse desde otro dispositivo mientras este estaba offline).
 */
async function applyIfNewer(
  fetchCurrent: () => Promise<{ userId: number; updatedAt: Date } | null>,
  userId: number,
  clientUpdatedAt: Date,
  apply: () => Promise<unknown>
): Promise<"applied" | "conflict" | "gone"> {
  const current = await fetchCurrent();
  if (!current || current.userId !== userId) return "gone";
  if (clientUpdatedAt.getTime() <= current.updatedAt.getTime()) return "conflict";
  await apply();
  return "applied";
}

// Los campos de sobre (localId / id / clientUpdatedAt / taskId) no son campos reales del
// modelo — se separan antes de pasarle el resto a los createX/updateX ya existentes.
function omit<T extends Record<string, unknown>>(obj: T, keys: string[]): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (!keys.includes(key)) result[key] = value;
  }
  return result;
}

/**
 * Aplica un lote de cambios hechos offline. Sin éxito parcial: si un elemento falla (datos
 * inconsistentes, etc.), toda la petición falla y el cliente puede reintentar — mantiene la
 * semántica simple para un caso de uso de un único usuario, en vez de una respuesta con éxito
 * parcial por elemento.
 */
export async function push(userId: number, body: SyncPushBody): Promise<PushResult> {
  const idMappings: IdMapping[] = [];
  const conflicts: ConflictInfo[] = [];

  // --- Events ---
  for (const input of body.events.create) {
    const created = await agendaService.createEvent(userId, omit(input, ["localId"]) as never);
    idMappings.push({ entityType: "event", localId: input.localId, id: created.id });
  }
  for (const input of body.events.update) {
    const result = await applyIfNewer(
      () => prisma.event.findUnique({ where: { id: input.id } }),
      userId,
      new Date(input.clientUpdatedAt),
      () => agendaService.updateEvent(userId, input.id, omit(input, ["id", "clientUpdatedAt"]) as never)
    );
    if (result === "conflict") conflicts.push({ entityType: "event", id: input.id });
  }

  // --- Event exceptions (siempre upsert — se identifican por eventId+originalStartTime, no
  // por un id propio conocido de antemano por el cliente) ---
  for (const input of body.eventExceptions.upsert) {
    await agendaService.setEventException(userId, input.eventId, omit(input, ["eventId"]) as never);
  }

  // --- Tasks ---
  for (const input of body.tasks.create) {
    const created = await plannerService.createTask(userId, omit(input, ["localId"]) as never);
    idMappings.push({ entityType: "task", localId: input.localId, id: created.id });
  }
  for (const input of body.tasks.update) {
    const result = await applyIfNewer(
      () => prisma.task.findUnique({ where: { id: input.id } }),
      userId,
      new Date(input.clientUpdatedAt),
      () => plannerService.updateTask(userId, input.id, omit(input, ["id", "clientUpdatedAt"]) as never)
    );
    if (result === "conflict") conflicts.push({ entityType: "task", id: input.id });
  }

  // --- Subtasks --- (addSubtask solo admite título; si llega con `completed: true` de origen,
  // se completa en un segundo paso — es lo mismo que hacer dos peticiones desde la web)
  for (const input of body.subtasks.create) {
    const created = await plannerService.addSubtask(userId, input.taskId, input.title);
    if (input.completed) {
      await plannerService.updateSubtask(userId, input.taskId, created.id, { completed: true });
    }
    idMappings.push({ entityType: "subtask", localId: input.localId, id: created.id });
  }
  for (const input of body.subtasks.update) {
    const result = await applyIfNewer(
      async () => {
        const subtask = await prisma.subtask.findUnique({ where: { id: input.id }, include: { task: { select: { userId: true } } } });
        return subtask ? { userId: subtask.task.userId, updatedAt: subtask.updatedAt } : null;
      },
      userId,
      new Date(input.clientUpdatedAt),
      () => plannerService.updateSubtask(userId, input.taskId, input.id, omit(input, ["id", "taskId", "clientUpdatedAt"]) as never)
    );
    if (result === "conflict") conflicts.push({ entityType: "subtask", id: input.id });
  }

  // --- Notes ---
  for (const input of body.notes.create) {
    const created = await notesService.createNote(userId, input.content);
    if (input.checked) {
      await notesService.updateNote(userId, created.id, { checked: true });
    }
    idMappings.push({ entityType: "note", localId: input.localId, id: created.id });
  }
  for (const input of body.notes.update) {
    const result = await applyIfNewer(
      () => prisma.note.findUnique({ where: { id: input.id } }),
      userId,
      new Date(input.clientUpdatedAt),
      () => notesService.updateNote(userId, input.id, omit(input, ["id", "clientUpdatedAt"]) as never)
    );
    if (result === "conflict") conflicts.push({ entityType: "note", id: input.id });
  }

  // --- Habits ---
  for (const input of body.habits.create) {
    const created = await habitsService.createHabit(userId, input.title);
    idMappings.push({ entityType: "habit", localId: input.localId, id: created.id });
  }
  for (const input of body.habits.update) {
    const result = await applyIfNewer(
      () => prisma.habit.findUnique({ where: { id: input.id } }),
      userId,
      new Date(input.clientUpdatedAt),
      () => habitsService.updateHabit(userId, input.id, input.title)
    );
    if (result === "conflict") conflicts.push({ entityType: "habit", id: input.id });
  }

  // --- HabitLogs --- (alta idempotente: si el día ya estaba marcado, no hace nada — evita
  // usar toggleHabitDay directamente, que DESMARCARÍA un día ya marcado por error de carrera)
  for (const input of body.habitLogs.create) {
    const date = new Date(input.date);
    const existing = await prisma.habitLog.findUnique({ where: { habitId_date: { habitId: input.habitId, date } } });
    if (existing) continue;
    const habit = await prisma.habit.findUnique({ where: { id: input.habitId } });
    if (!habit || habit.userId !== userId) continue; // no es tuyo o ya no existe — se ignora, no es un error de sync
    await prisma.habitLog.create({ data: { habitId: input.habitId, userId, date } });
  }

  // --- Deletes ---
  for (const del of body.deletes) {
    try {
      if (del.entityType === "event") await agendaService.deleteEvent(userId, del.id);
      else if (del.entityType === "task") await plannerService.deleteTask(userId, del.id);
      else if (del.entityType === "note") await notesService.deleteNote(userId, del.id);
      else if (del.entityType === "habit") await habitsService.deleteHabit(userId, del.id);
      else if (del.entityType === "subtask") await plannerService.deleteSubtask(userId, del.taskId, del.id);
      else if (del.entityType === "eventException") {
        await agendaService.deleteEventException(userId, del.eventId, del.originalStartTime);
      } else if (del.entityType === "habitLog") {
        const date = new Date(del.date);
        const existing = await prisma.habitLog.findUnique({ where: { habitId_date: { habitId: del.habitId, date } } });
        if (existing) await habitsService.toggleHabitDay(userId, del.habitId, del.date);
      }
    } catch (error) {
      // Ya borrado desde otro dispositivo (NotFoundError) — idempotente, no es un fallo del
      // push. Cualquier otro error (p.ej. ForbiddenError) sí se propaga.
      if ((error as { statusCode?: number }).statusCode !== 404) throw error;
    }
  }

  logger.info(`sync push: ${idMappings.length} creado(s), ${conflicts.length} conflicto(s)`, { userId });
  return { idMappings, conflicts };
}

// Formas de entrada aceptadas por `push` — ya validadas por syncValidators.syncPushSchema antes
// de llegar aquí (stripUnknown + reglas por campo); estos tipos son deliberadamente laxos
// (`Record<string, unknown>` en los envoltorios) porque el resto de campos varía por sub-tipo y
// ya se reenvían tal cual a los servicios existentes, que son quienes de verdad los validan de
// forma estructural en tiempo de ejecución.
interface CreateEnvelope {
  localId: string;
  [key: string]: unknown;
}
interface UpdateEnvelope {
  id: number;
  clientUpdatedAt: string;
  [key: string]: unknown;
}
interface SyncPushBody {
  events: { create: CreateEnvelope[]; update: UpdateEnvelope[] };
  eventExceptions: { upsert: { eventId: number; [key: string]: unknown }[] };
  tasks: { create: CreateEnvelope[]; update: UpdateEnvelope[] };
  subtasks: {
    create: (CreateEnvelope & { taskId: number; title: string; completed?: boolean })[];
    update: (UpdateEnvelope & { taskId: number })[];
  };
  notes: { create: (CreateEnvelope & { content: string; checked?: boolean })[]; update: UpdateEnvelope[] };
  habits: { create: (CreateEnvelope & { title: string })[]; update: (UpdateEnvelope & { title: string })[] };
  habitLogs: { create: { habitId: number; date: string }[] };
  deletes: (
    | { entityType: "event" | "task" | "note" | "habit"; id: number }
    | { entityType: "subtask"; id: number; taskId: number }
    | { entityType: "eventException"; eventId: number; originalStartTime: string }
    | { entityType: "habitLog"; habitId: number; date: string }
  )[];
}
