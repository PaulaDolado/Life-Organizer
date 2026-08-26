import { Router } from "express";
import * as habitsController from "../controllers/habitsController";
import { authMiddleware } from "../middlewares/authMiddleware";
import { validate } from "../middlewares/validation";
import { idParamSchema, createHabitSchema, updateHabitSchema, toggleHabitSchema } from "../validators/habitsValidators";

const router = Router();

router.use(authMiddleware);

/**
 * @openapi
 * /habits:
 *   get:
 *     tags: [Habits]
 *     summary: Lista los hábitos activos del usuario, con racha y últimos 30 días marcados
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Lista de hábitos }
 *   post:
 *     tags: [Habits]
 *     summary: Crear hábito
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       201: { description: Hábito creado }
 */
router.get("/", habitsController.listHabits);
router.post("/", validate(createHabitSchema), habitsController.createHabit);

/**
 * @openapi
 * /habits/{id}:
 *   put:
 *     tags: [Habits]
 *     summary: Renombrar hábito
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Hábito actualizado }
 *   delete:
 *     tags: [Habits]
 *     summary: Eliminar hábito
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Hábito eliminado }
 */
router.put("/:id", validate(idParamSchema, "params"), validate(updateHabitSchema), habitsController.updateHabit);
router.delete("/:id", validate(idParamSchema, "params"), habitsController.deleteHabit);

/**
 * @openapi
 * /habits/{id}/toggle:
 *   post:
 *     tags: [Habits]
 *     summary: Marca o desmarca un día (hoy por defecto) para el hábito
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Día marcado/desmarcado }
 */
router.post(
  "/:id/toggle",
  validate(idParamSchema, "params"),
  validate(toggleHabitSchema),
  habitsController.toggleHabit
);

export default router;
