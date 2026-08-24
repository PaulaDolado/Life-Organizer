import { Router } from "express";
import * as agendaController from "../controllers/agendaController";
import { authMiddleware } from "../middlewares/authMiddleware";
import { validate } from "../middlewares/validation";
import {
  dateParamSchema,
  idParamSchema,
  createEventSchema,
  updateEventSchema,
  eventTypeQuerySchema,
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
 *     summary: Editar evento
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

export default router;
