import { Response, NextFunction } from "express";
import { AuthRequest } from "../middlewares/authMiddleware";
import * as plannerService from "../services/plannerService";

export async function listPlanners(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.userId as number;
    const result = await plannerService.listPlanners(userId);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function createPlanner(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.userId as number;
    const planner = await plannerService.createPlanner(userId, req.body.name);
    res.status(201).json(planner);
  } catch (error) {
    next(error);
  }
}

export async function updatePlanner(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.userId as number;
    const id = parseInt(req.params.id, 10);
    const planner = await plannerService.updatePlanner(userId, id, req.body.name);
    res.json(planner);
  } catch (error) {
    next(error);
  }
}

export async function deletePlanner(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.userId as number;
    const id = parseInt(req.params.id, 10);
    await plannerService.deletePlanner(userId, id);
    res.json({ message: "Planificador eliminado" });
  } catch (error) {
    next(error);
  }
}

export async function movePlanner(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.userId as number;
    const id = parseInt(req.params.id, 10);
    await plannerService.movePlanner(userId, id, req.body.direction);
    res.json({ message: "Planificador movido" });
  } catch (error) {
    next(error);
  }
}

export async function listFields(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.userId as number;
    const plannerId = parseInt(req.params.id, 10);
    const result = await plannerService.listFields(userId, plannerId);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function createField(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.userId as number;
    const plannerId = parseInt(req.params.id, 10);
    const field = await plannerService.createField(userId, plannerId, req.body);
    res.status(201).json(field);
  } catch (error) {
    next(error);
  }
}

export async function updateField(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.userId as number;
    const plannerId = parseInt(req.params.id, 10);
    const fieldId = parseInt(req.params.fieldId, 10);
    const field = await plannerService.updateField(userId, plannerId, fieldId, req.body);
    res.json(field);
  } catch (error) {
    next(error);
  }
}

export async function deleteField(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.userId as number;
    const plannerId = parseInt(req.params.id, 10);
    const fieldId = parseInt(req.params.fieldId, 10);
    await plannerService.deleteField(userId, plannerId, fieldId);
    res.json({ message: "Columna eliminada" });
  } catch (error) {
    next(error);
  }
}

export async function moveField(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.userId as number;
    const plannerId = parseInt(req.params.id, 10);
    const fieldId = parseInt(req.params.fieldId, 10);
    await plannerService.moveField(userId, plannerId, fieldId, req.body.direction);
    res.json({ message: "Columna movida" });
  } catch (error) {
    next(error);
  }
}

export async function listTasks(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.userId as number;
    const { plannerId, projectId, tag } = req.query as { plannerId?: number; projectId?: number; tag?: string };
    const result = await plannerService.listTasks(userId, { plannerId, projectId, tag });
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
