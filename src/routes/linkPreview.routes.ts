import { Router } from "express";
import * as linkPreviewController from "../controllers/linkPreviewController";
import { authMiddleware } from "../middlewares/authMiddleware";
import { validate } from "../middlewares/validation";
import { linkPreviewQuerySchema } from "../validators/linkPreviewValidators";

const router = Router();

router.use(authMiddleware);

/**
 * @openapi
 * /link-preview:
 *   get:
 *     tags: [LinkPreview]
 *     summary: Obtiene título, descripción e imagen de una URL (para la "miniatura web" del editor de páginas)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: url
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: "{ url, title, description, image, siteName }" }
 */
router.get("/", validate(linkPreviewQuerySchema, "query"), linkPreviewController.getPreview);

export default router;
