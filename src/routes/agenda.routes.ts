import { Router } from "express";
import * as agendaController from "../controllers/agendaController";
import { authMiddleware } from "../middlewares/authMiddleware";
import { validate } from "../middlewares/validation";
import {
  dateParamSchema,
  idParamSchema,
  exceptionParamSchema,
  createEventSchema,
  updateEventSchema,
  eventTypeQuerySchema,
  setExceptionSchema,
  importIcsSchema,
} from "../validators/agendaValidators";

const router = Router();

router.use(authMiddleware);

/**
 * @openapi
 * /agenda/day/{date}:
 *   get:
 *     tags: [Agenda]
 *     summary: Eventos del día
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: date
 *         required: true
 *         schema: { type: string, example: "2026-08-24" }
 *       - in: query
 *         name: type
 *         schema: { type: string, enum: [work, study, gym, meeting, free] }
 *     responses:
 *       200: { description: Lista de eventos del día }
 */
router.get(
  "/day/:date",
  validate(dateParamSchema, "params"),
  validate(eventTypeQuerySchema, "query"),
  agendaController.getAgendaDay
);

/**
 * @openapi
 * /agenda/week/{date}:
 *   get:
 *     tags: [Agenda]
 *     summary: Eventos de la semana que contiene la fecha dada
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: date
 *         required: true
 *         schema: { type: string, example: "2026-08-24" }
 *       - in: query
 *         name: type
 *         schema: { type: string, enum: [work, study, gym, meeting, free] }
 *     responses:
 *       200: { description: Lista de eventos de la semana }
 */
router.get(
  "/week/:date",
  validate(dateParamSchema, "params"),
  validate(eventTypeQuerySchema, "query"),
  agendaController.getAgendaWeek
);

/**
 * @openapi
 * /agenda/month/{date}:
 *   get:
 *     tags: [Agenda]
 *     summary: Eventos del mes que contiene la fecha dada
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: date
 *         required: true
 *         schema: { type: string, example: "2026-08-24" }
 *       - in: query
 *         name: type
 *         schema: { type: string, enum: [work, study, gym, meeting, free] }
 *     responses:
 *       200: { description: Lista de eventos del mes }
 */
router.get(
  "/month/:date",
  validate(dateParamSchema, "params"),
  validate(eventTypeQuerySchema, "query"),
  agendaController.getAgendaMonth
);

/**
 * @openapi
 * /agenda/free-time/{date}:
 *   get:
 *     tags: [Agenda]
 *     summary: Huecos libres del día (08:00–22:00 local) y sugerencias de tareas del Planificador que encajan
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: date
 *         required: true
 *         schema: { type: string, example: "2026-08-24" }
 *     responses:
 *       200: { description: Huecos libres y sugerencias }
 */
router.get("/free-time/:date", validate(dateParamSchema, "params"), agendaController.getFreeTime);

/**
 * @openapi
 * /agenda/ics:
 *   get:
 *     tags: [Agenda]
 *     summary: Exporta todos los eventos del usuario como .ics (Google Calendar, Outlook...)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Archivo .ics, Content-Type text/calendar }
 */
router.get("/ics", agendaController.exportIcs);

/**
 * @openapi
 * /agenda/ics/import:
 *   post:
 *     tags: [Agenda]
 *     summary: Importa eventos desde un .ics (contenido como texto en el body)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       201: { description: "Resumen: { created, skippedUnparsable, importedAsSingleOccurrence }" }
 */
router.post("/ics/import", validate(importIcsSchema), agendaController.importIcs);

/**
 * @openapi
 * /agenda/events:
 *   post:
 *     tags: [Agenda]
 *     summary: Crear evento
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       201: { description: Evento creado }
 */
router.post("/events", validate(createEventSchema), agendaController.createEvent);

/**
 * @openapi
 * /agenda/events/{id}:
 *   put:
 *     tags: [Agenda]
 *     summary: Editar evento (título, horario, recurrencia, recordatorios o invitados) — afecta a toda la serie si es recurrente
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Evento actualizado }
 *       403: { description: No autorizado }
 *       404: { description: Evento no encontrado }
 */
router.put(
  "/events/:id",
  validate(idParamSchema, "params"),
  validate(updateEventSchema),
  agendaController.updateEvent
);

/**
 * @openapi
 * /agenda/events/{id}:
 *   delete:
 *     tags: [Agenda]
 *     summary: Eliminar evento
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Evento eliminado }
 *       403: { description: No autorizado }
 *       404: { description: Evento no encontrado }
 */
router.delete("/events/:id", validate(idParamSchema, "params"), agendaController.deleteEvent);

/**
 * @openapi
 * /agenda/events/{id}/exceptions:
 *   post:
 *     tags: [Agenda]
 *     summary: Mover o cancelar UNA ocurrencia de un evento recurrente, sin afectar al resto de la serie
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       201: { description: Excepción creada o actualizada }
 *       400: { description: El evento no es recurrente, o faltan newStartTime/newEndTime para mover }
 */
router.post(
  "/events/:id/exceptions",
  validate(idParamSchema, "params"),
  validate(setExceptionSchema),
  agendaController.setEventException
);

/**
 * @openapi
 * /agenda/events/{id}/exceptions/{originalStartTime}:
 *   delete:
 *     tags: [Agenda]
 *     summary: Revertir la excepción de una ocurrencia (vuelve a mostrarse en su horario natural)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Excepción eliminada }
 */
router.delete(
  "/events/:id/exceptions/:originalStartTime",
  validate(exceptionParamSchema, "params"),
  agendaController.deleteEventException
);

export default router;
