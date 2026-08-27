import Joi from "joi";
import { createEventSchema, updateEventSchema, setExceptionSchema } from "./agendaValidators";
import { createTaskSchema, updateTaskSchema, createSubtaskSchema, updateSubtaskSchema } from "./plannerValidators";
import { createNoteSchema, updateNoteSchema } from "./notesValidators";
import { createHabitSchema, updateHabitSchema } from "./habitsValidators";

export const syncPullQuerySchema = Joi.object({
  // Sin `since`: bootstrap completo (todo lo del usuario, sin filtrar por fecha).
  since: Joi.date().iso(),
}).options({ stripUnknown: true });

// Envoltorio común de "creado offline" (localId, sin id de servidor todavía) — se compone
// sobre los schemas de creación YA existentes en cada módulo (agendaValidators/
// plannerValidators/notesValidators/habitsValidators) en vez de redeclarar las reglas de cada
// campo, para que un evento/tarea/nota/hábito sincronizado valide exactamente igual que uno
// creado desde la web.
const localIdField = { localId: Joi.string().uuid().required() };
// Envoltorio común de "editado offline" (id real del servidor + cuándo se hizo el cambio en el
// dispositivo, para la resolución de conflictos por last-write-wins — ver syncService.ts).
const updateEnvelope = { id: Joi.number().integer().positive().required(), clientUpdatedAt: Joi.date().iso().required() };

const eventsSchema = Joi.object({
  create: Joi.array().items(createEventSchema.keys(localIdField)).default([]),
  update: Joi.array().items(updateEventSchema.keys(updateEnvelope)).default([]),
}).default({ create: [], update: [] });

// Una excepción no tiene "localId": se identifica por (eventId, originalStartTime), no por un
// id propio generado por el cliente — por eso es un único array "upsert", igual que
// `agendaService.setEventException` ya upsertea.
const eventExceptionsSchema = Joi.object({
  upsert: Joi.array()
    .items(setExceptionSchema.keys({ eventId: Joi.number().integer().positive().required() }))
    .default([]),
}).default({ upsert: [] });

const tasksSchema = Joi.object({
  create: Joi.array().items(createTaskSchema.keys(localIdField)).default([]),
  update: Joi.array().items(updateTaskSchema.keys(updateEnvelope)).default([]),
}).default({ create: [], update: [] });

const subtaskParentField = { taskId: Joi.number().integer().positive().required() };
// `createSubtaskSchema` solo admite `title` (así lo espera `addSubtask`, que no recibe estado
// inicial) — pero una subtarea creada offline puede haberse completado antes de sincronizar
// nunca, así que aquí se añade `completed` como opcional (syncService la aplica en un segundo
// paso tras crear, ver syncService.ts).
const subtasksSchema = Joi.object({
  create: Joi.array()
    .items(createSubtaskSchema.keys({ ...localIdField, ...subtaskParentField, completed: Joi.boolean() }))
    .default([]),
  update: Joi.array()
    .items(updateSubtaskSchema.keys({ ...updateEnvelope, ...subtaskParentField }))
    .default([]),
}).default({ create: [], update: [] });

// Igual que con las subtareas: `createNoteSchema` solo admite `content`, pero una nota rápida
// creada offline puede haberse marcado como hecha antes de sincronizar — `checked` opcional.
const notesSchema = Joi.object({
  create: Joi.array().items(createNoteSchema.keys({ ...localIdField, checked: Joi.boolean() })).default([]),
  update: Joi.array().items(updateNoteSchema.keys(updateEnvelope)).default([]),
}).default({ create: [], update: [] });

const habitsSchema = Joi.object({
  create: Joi.array().items(createHabitSchema.keys(localIdField)).default([]),
  update: Joi.array().items(updateHabitSchema.keys(updateEnvelope)).default([]),
}).default({ create: [], update: [] });

// HabitLog no se edita in-place (solo alta/baja, ver habitsService.toggleHabitDay) — no hay
// "update", y la creación no lleva localId propio: se identifica por (habitId, date), igual
// que las excepciones de evento.
const habitLogsSchema = Joi.object({
  create: Joi.array()
    .items(
      Joi.object({
        habitId: Joi.number().integer().positive().required(),
        date: Joi.string()
          .pattern(/^\d{4}-\d{2}-\d{2}$/)
          .required(),
      })
    )
    .default([]),
}).default({ create: [] });

// Tres formas de "borrar", según cómo se identifica cada tipo (ver syncService.ts):
// - la mayoría por su `id` de servidor;
// - una excepción de evento por (eventId, originalStartTime) — no tiene id propio conocido
//   por el cliente hasta que hace un pull;
// - una subtarea necesita también `taskId` (deleteSubtask lo exige, ver plannerService.ts);
// - un HabitLog se borra "desmarcando el día" (habitId, date) — no por id, igual que un
//   registro no se referencia por id en ningún otro sitio de la app (ver habitsService.ts).
const deleteSchema = Joi.alternatives().try(
  Joi.object({
    entityType: Joi.string().valid("event", "task", "note", "habit").required(),
    id: Joi.number().integer().positive().required(),
  }),
  Joi.object({
    entityType: Joi.string().valid("subtask").required(),
    id: Joi.number().integer().positive().required(),
    taskId: Joi.number().integer().positive().required(),
  }),
  Joi.object({
    entityType: Joi.string().valid("eventException").required(),
    eventId: Joi.number().integer().positive().required(),
    originalStartTime: Joi.date().iso().required(),
  }),
  Joi.object({
    entityType: Joi.string().valid("habitLog").required(),
    habitId: Joi.number().integer().positive().required(),
    date: Joi.string()
      .pattern(/^\d{4}-\d{2}-\d{2}$/)
      .required(),
  })
);

export const syncPushSchema = Joi.object({
  events: eventsSchema,
  eventExceptions: eventExceptionsSchema,
  tasks: tasksSchema,
  subtasks: subtasksSchema,
  notes: notesSchema,
  habits: habitsSchema,
  habitLogs: habitLogsSchema,
  deletes: Joi.array().items(deleteSchema).default([]),
}).options({ stripUnknown: true });
