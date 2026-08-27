import { Router } from "express";
import * as todayController from "../controllers/todayController";
import { authMiddleware } from "../middlewares/authMiddleware";

const router = Router();

router.use(authMiddleware);

/**
 * @openapi
 * /today:
 *   get:
 *     tags: [Today]
 *     summary: Vista "Hoy" combinada — eventos de hoy, tareas con vencimiento hoy, hábitos, notas y racha combinada
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Resumen del día }
 */
router.get("/", todayController.getToday);

export default router;
