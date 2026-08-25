import { Response, NextFunction } from "express";
import { AuthRequest } from "../middlewares/authMiddleware";
import * as notificationService from "../services/notificationService";

export async function listNotifications(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.userId as number;
    const { unreadOnly, page, limit } = req.query as unknown as {
      unreadOnly: boolean;
      page: number;
      limit: number;
    };
    const result = await notificationService.listNotifications(userId, { unreadOnly, page, limit });
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function getUnreadCount(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.userId as number;
    const result = await notificationService.getUnreadCount(userId);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function markAsRead(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.userId as number;
    const id = parseInt(req.params.id, 10);
    const notification = await notificationService.markAsRead(userId, id);
    res.json(notification);
  } catch (error) {
    next(error);
  }
}

export async function markAllAsRead(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.userId as number;
    const result = await notificationService.markAllAsRead(userId);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function deleteNotification(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.userId as number;
    const id = parseInt(req.params.id, 10);
    await notificationService.deleteNotification(userId, id);
    res.json({ message: "Notificación eliminada" });
  } catch (error) {
    next(error);
  }
}
