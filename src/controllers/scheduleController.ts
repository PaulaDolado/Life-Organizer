import { Response, NextFunction } from "express";
import { AuthRequest } from "../middlewares/authMiddleware";
import * as scheduleService from "../services/scheduleService";

export async function listRows(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.userId as number;
    const result = await scheduleService.listRows(userId);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function addRow(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.userId as number;
    const row = await scheduleService.addRow(userId, req.body.timeLabel);
    res.status(201).json(row);
  } catch (error) {
    next(error);
  }
}

export async function updateRow(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.userId as number;
    const id = parseInt(req.params.id, 10);
    const row = await scheduleService.updateRow(userId, id, req.body);
    res.json(row);
  } catch (error) {
    next(error);
  }
}

export async function deleteRow(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.userId as number;
    const id = parseInt(req.params.id, 10);
    await scheduleService.deleteRow(userId, id);
    res.json({ message: "Fila eliminada" });
  } catch (error) {
    next(error);
  }
}

export async function moveRow(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.userId as number;
    const id = parseInt(req.params.id, 10);
    await scheduleService.moveRow(userId, id, req.body.direction);
    res.json({ message: "Fila movida" });
  } catch (error) {
    next(error);
  }
}
