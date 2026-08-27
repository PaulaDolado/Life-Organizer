import { Router } from "express";
import * as searchController from "../controllers/searchController";
import { authMiddleware } from "../middlewares/authMiddleware";
import { validate } from "../middlewares/validation";
import { searchQuerySchema } from "../validators/searchValidators";

const router = Router();

router.use(authMiddleware);

/**
 * @openapi
 * /search:
 *   get:
 *     tags: [Search]
 *     summary: Búsqueda global entre eventos, tareas, notas y proyectos del usuario
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Resultados agrupados por tipo }
 */
router.get("/", validate(searchQuerySchema, "query"), searchController.search);

export default router;
