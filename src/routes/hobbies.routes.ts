import { Router } from "express";
import * as hobbiesController from "../controllers/hobbiesController";
import { authMiddleware } from "../middlewares/authMiddleware";
import { validate } from "../middlewares/validation";
import {
  idParamSchema,
  categoryParamSchema,
  createHobbySchema,
  updateHobbySchema,
  createSessionSchema,
} from "../validators/hobbiesValidators";

const router = Router();

router.use(authMiddleware);

/**
 * @openapi
 * /hobbies:
 *   get:
 *     tags: [Hobbies]
 *     summary: Lista hobbies del usuario
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Lista de hobbies }
 *   post:
 *     tags: [Hobbies]
 *     summary: Crear hobby
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       201: { description: Hobby creado }
 */
router.get("/", hobbiesController.listHobbies);
router.post("/", validate(createHobbySchema), hobbiesController.createHobby);

/**
 * @openapi
 * /hobbies/category/{category}:
 *   get:
 *     tags: [Hobbies]
 *     summary: Filtrar hobbies por categoría
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: category
 *         required: true
 *         schema: { type: string, enum: [reading, gaming, music, sports, art] }
 *     responses:
 *       200: { description: Hobbies de la categoría }
 */
router.get(
  "/category/:category",
  validate(categoryParamSchema, "params"),
  hobbiesController.listByCategory
);

/**
 * @openapi
 * /hobbies/{id}:
 *   put:
 *     tags: [Hobbies]
 *     summary: Editar hobby
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Hobby actualizado }
 *   delete:
 *     tags: [Hobbies]
 *     summary: Eliminar hobby
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Hobby eliminado }
 */
router.put(
  "/:id",
  validate(idParamSchema, "params"),
  validate(updateHobbySchema),
  hobbiesController.updateHobby
);
router.delete("/:id", validate(idParamSchema, "params"), hobbiesController.deleteHobby);

/**
 * @openapi
 * /hobbies/{id}/sessions:
 *   post:
 *     tags: [Hobbies]
 *     summary: Registrar sesión de hobby
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       201: { description: Sesión registrada }
 */
router.post(
  "/:id/sessions",
  validate(idParamSchema, "params"),
  validate(createSessionSchema),
  hobbiesController.addSession
);

/**
 * @openapi
 * /hobbies/{id}/analytics:
 *   get:
 *     tags: [Hobbies]
 *     summary: Horas totales y últimas sesiones de un hobby
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Analytics del hobby }
 */
router.get("/:id/analytics", validate(idParamSchema, "params"), hobbiesController.getAnalytics);

export default router;
