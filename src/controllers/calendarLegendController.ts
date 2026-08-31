import { Response, NextFunction } from "express";
import { AuthRequest } from "../middlewares/authMiddleware";
import * as calendarLegendService from "../services/calendarLegendService";

export async function listCategories(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.userId as number;
    const result = await calendarLegendService.listCategories(userId);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function createCategory(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.userId as number;
    const category = await calendarLegendService.createCategory(userId, req.body.label, req.body.color);
    res.status(201).json(category);
  } catch (error) {
    next(error);
  }
}

export async function updateCategory(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.userId as number;
    const id = parseInt(req.params.id, 10);
    const category = await calendarLegendService.updateCategory(userId, id, req.body);
    res.json(category);
  } catch (error) {
    next(error);
  }
}

export async function deleteCategory(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.userId as number;
    const id = parseInt(req.params.id, 10);
    await calendarLegendService.deleteCategory(userId, id);
    res.json({ message: "Categoría eliminada" });
  } catch (error) {
    next(error);
  }
}

export async function listMarks(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.userId as number;
    const { from, to } = req.query as unknown as { from: string; to: string };
    const result = await calendarLegendService.listMarks(userId, from, to);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function setDayMark(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.userId as number;
    const { date } = req.params;
    const mark = await calendarLegendService.setDayMark(userId, date, req.body.categoryId);
    res.json(mark);
  } catch (error) {
    next(error);
  }
}
