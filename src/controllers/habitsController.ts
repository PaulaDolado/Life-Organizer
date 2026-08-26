import { Response, NextFunction } from "express";
import { AuthRequest } from "../middlewares/authMiddleware";
import * as habitsService from "../services/habitsService";

export async function listHabits(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.userId as number;
    const result = await habitsService.listHabits(userId);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function createHabit(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.userId as number;
    const habit = await habitsService.createHabit(userId, req.body.title);
    res.status(201).json(habit);
  } catch (error) {
    next(error);
  }
}

export async function updateHabit(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.userId as number;
    const id = parseInt(req.params.id, 10);
    const habit = await habitsService.updateHabit(userId, id, req.body.title);
    res.json(habit);
  } catch (error) {
    next(error);
  }
}

export async function deleteHabit(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.userId as number;
    const id = parseInt(req.params.id, 10);
    await habitsService.deleteHabit(userId, id);
    res.json({ message: "Hábito eliminado" });
  } catch (error) {
    next(error);
  }
}

export async function toggleHabit(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.userId as number;
    const id = parseInt(req.params.id, 10);
    const result = await habitsService.toggleHabitDay(userId, id, req.body.date);
    res.json(result);
  } catch (error) {
    next(error);
  }
}
