import { Router } from "express";
import * as scheduleController from "../controllers/scheduleController";
import { authMiddleware } from "../middlewares/authMiddleware";
import { validate } from "../middlewares/validation";
import {
  idParamSchema,
  rowParamsSchema,
  createScheduleSchema,
  updateScheduleSchema,
  addRowSchema,
  updateRowSchema,
  moveSchema,
} from "../validators/scheduleValidators";

const router = Router();

router.use(authMiddleware);

/**
 * @openapi
 * /schedule:
 *   get:
 *     tags: [Schedule]
 *     summary: Lista los horarios del usuario (uno por trimestre/semestre), ordenados
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: "{ schedules: [...] }" }
 *   post:
 *     tags: [Schedule]
 *     summary: Crea un horario nuevo con nombre propio (p.ej. "1r trimestre")
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       201: { description: Horario creado, sin filas }
 */
router.get("/", scheduleController.listSchedules);
router.post("/", validate(createScheduleSchema), scheduleController.createSchedule);

/**
 * @openapi
 * /schedule/{id}:
 *   put:
 *     tags: [Schedule]
 *     summary: Renombra un horario
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Horario actualizado }
 *   delete:
 *     tags: [Schedule]
 *     summary: Elimina un horario y todas sus filas
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Horario eliminado }
 */
router.put("/:id", validate(idParamSchema, "params"), validate(updateScheduleSchema), scheduleController.updateSchedule);
router.delete("/:id", validate(idParamSchema, "params"), scheduleController.deleteSchedule);

/**
 * @openapi
 * /schedule/{id}/move:
 *   put:
 *     tags: [Schedule]
 *     summary: Sube o baja un horario un puesto entre los del usuario
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Horario movido (no-op si ya está en el extremo) }
 */
router.put("/:id/move", validate(idParamSchema, "params"), validate(moveSchema), scheduleController.moveSchedule);

/**
 * @openapi
 * /schedule/{id}/rows:
 *   get:
 *     tags: [Schedule]
 *     summary: Lista las filas (franjas horarias) de un horario
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: "{ rows: [...] }, ordenadas por `order`" }
 *   post:
 *     tags: [Schedule]
 *     summary: Añade una fila nueva al final de un horario
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       201: { description: Fila creada }
 */
router.get("/:id/rows", validate(idParamSchema, "params"), scheduleController.listRows);
router.post("/:id/rows", validate(idParamSchema, "params"), validate(addRowSchema), scheduleController.addRow);

/**
 * @openapi
 * /schedule/{id}/rows/{rowId}:
 *   put:
 *     tags: [Schedule]
 *     summary: Edita el rótulo de hora y/o el texto de cualquiera de las 5 celdas (lunes-viernes) de una fila
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Fila actualizada }
 *   delete:
 *     tags: [Schedule]
 *     summary: Elimina una fila de un horario
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Fila eliminada }
 */
router.put(
  "/:id/rows/:rowId",
  validate(rowParamsSchema, "params"),
  validate(updateRowSchema),
  scheduleController.updateRow
);
router.delete("/:id/rows/:rowId", validate(rowParamsSchema, "params"), scheduleController.deleteRow);

/**
 * @openapi
 * /schedule/{id}/rows/{rowId}/move:
 *   put:
 *     tags: [Schedule]
 *     summary: Sube o baja una fila un puesto dentro de su horario
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Fila movida (no-op si ya está en el extremo) }
 */
router.put(
  "/:id/rows/:rowId/move",
  validate(rowParamsSchema, "params"),
  validate(moveSchema),
  scheduleController.moveRow
);

export default router;
