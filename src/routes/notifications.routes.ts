import { Router } from "express";
import * as notificationsController from "../controllers/notificationsController";
import { authMiddleware } from "../middlewares/authMiddleware";
import { validate } from "../middlewares/validation";
import { idParamSchema, listNotificationsQuerySchema } from "../validators/notificationsValidators";

const router = Router();

router.use(authMiddleware);

/**
 * @openapi
 * /notifications:
 *   get:
 *     tags: [Notifications]
 *     summary: Lista notificaciones del usuario (recordatorios de eventos, alertas de metas en riesgo)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: unreadOnly
 *         schema: { type: boolean, default: false }
 *     responses:
 *       200: { description: Lista paginada de notificaciones }
 */
router.get("/", validate(listNotificationsQuerySchema, "query"), notificationsController.listNotifications);

/**
 * @openapi
 * /notifications/unread-count:
 *   get:
 *     tags: [Notifications]
 *     summary: Nº de notificaciones no leídas (para el badge de la campanita)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: "{ unreadCount: number }" }
 */
router.get("/unread-count", notificationsController.getUnreadCount);

/**
 * @openapi
 * /notifications/read-all:
 *   put:
 *     tags: [Notifications]
 *     summary: Marcar todas las notificaciones como leídas
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: "{ updated: number }" }
 */
router.put("/read-all", notificationsController.markAllAsRead);

/**
 * @openapi
 * /notifications/{id}/read:
 *   put:
 *     tags: [Notifications]
 *     summary: Marcar una notificación como leída
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Notificación actualizada }
 */
router.put("/:id/read", validate(idParamSchema, "params"), notificationsController.markAsRead);

/**
 * @openapi
 * /notifications/{id}:
 *   delete:
 *     tags: [Notifications]
 *     summary: Eliminar una notificación
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Notificación eliminada }
 */
router.delete("/:id", validate(idParamSchema, "params"), notificationsController.deleteNotification);

export default router;
