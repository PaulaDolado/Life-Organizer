import { Router } from "express";
import * as syncController from "../controllers/syncController";
import { authMiddleware } from "../middlewares/authMiddleware";
import { validate } from "../middlewares/validation";
import { syncPullQuerySchema, syncPushSchema } from "../validators/syncValidators";

const router = Router();

router.use(authMiddleware);

/**
 * @openapi
 * /sync/pull:
 *   get:
 *     tags: [Sync]
 *     summary: Descarga cambios (eventos, tareas, notas, hábitos...) desde `since` para el cliente offline
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: since
 *         schema: { type: string, format: date-time }
 *         description: Cursor ISO-8601 devuelto por el `pull` anterior (el propio `serverTime`). Sin `since`, bootstrap completo.
 *     responses:
 *       200: { description: Cambios desde el cursor, más un nuevo cursor `serverTime` y los tombstones de lo borrado }
 */
router.get("/pull", validate(syncPullQuerySchema, "query"), syncController.pull);

/**
 * @openapi
 * /sync/push:
 *   post:
 *     tags: [Sync]
 *     summary: Sube cambios hechos offline (creados, editados, borrados) y reconcilia con el servidor
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Mapeo de localId→id para lo creado, y conflictos (last-write-wins) para lo editado }
 */
router.post("/push", validate(syncPushSchema), syncController.push);

export default router;
