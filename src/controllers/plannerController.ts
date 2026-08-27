import { Response, NextFunction } from "express";
import { AuthRequest } from "../middlewares/authMiddleware";
import * as plannerService from "../services/plannerService";

export async function listTasks(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.userId as number;
    const { projectId, tag } = req.query as { projectId?: number; tag?: string };
    const result = await plannerService.listTasks(userId, { projectId, tag });
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function createTask(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.userId as number;
    const task = await plannerService.createTask(userId, req.body);
    res.status(201).json(task);
  } catch (error) {
    next(error);
  }
}

export async function updateTask(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.userId as number;
    const id = parseInt(req.params.id, 10);
    const task = await plannerService.updateTask(userId, id, req.body);
    res.json(task);
  } catch (error) {
    next(error);
  }
}

export async function deleteTask(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.userId as number;
    const id = parseInt(req.params.id, 10);
    await plannerService.deleteTask(userId, id);
    res.json({ message: "Tarea eliminada" });
  } catch (error) {
    next(error);
  }
}

export async function logTime(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.userId as number;
    const id = parseInt(req.params.id, 10);
    const task = await plannerService.logTime(userId, id, req.body.minutes);
    res.json(task);
  } catch (error) {
    next(error);
  }
}

export async function addSubtask(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.userId as number;
    const taskId = parseInt(req.params.id, 10);
    const subtask = await plannerService.addSubtask(userId, taskId, req.body.title);
    res.status(201).json(subtask);
  } catch (error) {
    next(error);
  }
}

export async function updateSubtask(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.userId as number;
    const taskId = parseInt(req.params.id, 10);
    const subtaskId = parseInt(req.params.subtaskId, 10);
    const subtask = await plannerService.updateSubtask(userId, taskId, subtaskId, req.body);
    res.json(subtask);
  } catch (error) {
    next(error);
  }
}

export async function deleteSubtask(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.userId as number;
    const taskId = parseInt(req.params.id, 10);
    const subtaskId = parseInt(req.params.subtaskId, 10);
    await plannerService.deleteSubtask(userId, taskId, subtaskId);
    res.json({ message: "Subtarea eliminada" });
  } catch (error) {
    next(error);
  }
}
