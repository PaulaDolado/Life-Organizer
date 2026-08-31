import { Router } from "express";
import * as calendarLegendController from "../controllers/calendarLegendController";
import { authMiddleware } from "../middlewares/authMiddleware";
import { validate } from "../middlewares/validation";
import {
  idParamSchema,
  dateParamSchema,
  createCategorySchema,
  updateCategorySchema,
  listMarksQuerySchema,
  setDayMarkSchema,
} from "../validators/calendarLegendValidators";

const router = Router();

router.use(authMiddleware);

/**
 * @openapi
 * /calendar-legend:
 *   get:
 *     tags: [CalendarLegend]
 *     summary: Lista las categorías de la leyenda del calendario anual (Horario > vista anual)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: "{ categories: [...] }" }
 *   post:
 *     tags: [CalendarLegend]
 *     summary: Crea una categoría nueva (nombre + color de la paleta de la app)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       201: { description: Categoría creada }
 */
router.get("/", calendarLegendController.listCategories);
router.post("/", validate(createCategorySchema), calendarLegendController.createCategory);

/**
 * @openapi
 * /calendar-legend/{id}:
 *   put:
 *     tags: [CalendarLegend]
 *     summary: Edita el nombre, color o el orden de una categoría
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Categoría actualizada }
 *   delete:
 *     tags: [CalendarLegend]
 *     summary: Elimina una categoría (y desmarca los días que la usaban)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Categoría eliminada }
 */
router.put("/:id", validate(idParamSchema, "params"), validate(updateCategorySchema), calendarLegendController.updateCategory);
router.delete("/:id", validate(idParamSchema, "params"), calendarLegendController.deleteCategory);

/**
 * @openapi
 * /calendar-legend/marks:
 *   get:
 *     tags: [CalendarLegend]
 *     summary: Lista los días pintados dentro de un rango de fechas
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: from
 *         required: true
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: to
 *         required: true
 *         schema: { type: string, format: date }
 *     responses:
 *       200: { description: "{ marks: [{ date, categoryId }] }" }
 */
router.get("/marks", validate(listMarksQuerySchema, "query"), calendarLegendController.listMarks);

/**
 * @openapi
 * /calendar-legend/marks/{date}:
 *   put:
 *     tags: [CalendarLegend]
 *     summary: Pinta (categoryId) o borra (categoryId null) la marca de un día concreto
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: "{ date, categoryId }" }
 */
router.put(
  "/marks/:date",
  validate(dateParamSchema, "params"),
  validate(setDayMarkSchema),
  calendarLegendController.setDayMark
);

export default router;
