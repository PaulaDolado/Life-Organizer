import { Router } from "express";
import * as scheduleController from "../controllers/scheduleController";
import { authMiddleware } from "../middlewares/authMiddleware";
import { validate } from "../middlewares/validation";
import { idParamSchema, addRowSchema, updateRowSchema, moveRowSchema } from "../validators/scheduleValidators";

const router = Router();

router.use(authMiddleware);

/**
 * @openapi
 * /schedule:
 *   get:
 *     tags: [Schedule]
 *     summary: Lista las filas del horario semanal fijo (p.ej. de universidad) del usuario
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: "{ rows: [...] }, ordenadas por `order`" }
 *   post:
 *     tags: [Schedule]
 *     summary: Añade una fila (franja horaria) nueva al final del horario
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       201: { description: Fila creada }
 */
router.get("/", scheduleController.listRows);
router.post("/", validate(addRowSchema), scheduleController.addRow);

/**
 * @openapi
 * /schedule/{id}:
 *   put:
 *     tags: [Schedule]
 *     summary: Edita el rótulo de hora y/o el texto de cualquiera de las 5 celdas (lunes-viernes) de una fila
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Fila actualizada }
 *   delete:
 *     tags: [Schedule]
 *     summary: Elimina una fila del horario
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Fila eliminada }
 */
router.put("/:id", validate(idParamSchema, "params"), validate(updateRowSchema), scheduleController.updateRow);
router.delete("/:id", validate(idParamSchema, "params"), scheduleController.deleteRow);

/**
 * @openapi
 * /schedule/{id}/move:
 *   put:
 *     tags: [Schedule]
 *     summary: Sube o baja una fila un puesto (intercambia su orden con la vecina)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Fila movida (no-op si ya está en el extremo) }
 */
router.put("/:id/move", validate(idParamSchema, "params"), validate(moveRowSchema), scheduleController.moveRow);

export default router;
