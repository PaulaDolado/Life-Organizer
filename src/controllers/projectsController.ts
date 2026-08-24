import { Response, NextFunction } from "express";
import { AuthRequest } from "../middlewares/authMiddleware";
import * as projectsService from "../services/projectsService";

export async function listProjects(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.userId as number;
    const { status, priority } = req.query as { status?: string; priority?: string };
    const projects = await projectsService.listProjects(userId, { status, priority });
    res.json({ projects });
  } catch (error) {
    next(error);
  }
}

export async function getProject(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.userId as number;
    const id = parseInt(req.params.id, 10);
    const project = await projectsService.getProjectDetail(userId, id);
    res.json(project);
  } catch (error) {
    next(error);
  }
}

export async function createProject(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.userId as number;
    const project = await projectsService.createProject(userId, req.body);
    res.status(201).json(project);
  } catch (error) {
    next(error);
  }
}

export async function updateProject(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.userId as number;
    const id = parseInt(req.params.id, 10);
    const project = await projectsService.updateProject(userId, id, req.body);
    res.json(project);
  } catch (error) {
    next(error);
  }
}

export async function deleteProject(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.userId as number;
    const id = parseInt(req.params.id, 10);
    await projectsService.deleteProject(userId, id);
    res.json({ message: "Proyecto eliminado" });
  } catch (error) {
    next(error);
  }
}

export async function getProgress(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.userId as number;
    const id = parseInt(req.params.id, 10);
    const progress = await projectsService.getProjectProgress(userId, id);
    res.json(progress);
  } catch (error) {
    next(error);
  }
}

export async function addTask(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.userId as number;
    const id = parseInt(req.params.id, 10);
    const task = await projectsService.addTask(userId, id, req.body.title);
    res.status(201).json(task);
  } catch (error) {
    next(error);
  }
}

export async function updateTask(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.userId as number;
    const id = parseInt(req.params.id, 10);
    const taskId = parseInt(req.params.taskId, 10);
    const task = await projectsService.updateTask(userId, id, taskId, req.body.title);
    res.json(task);
  } catch (error) {
    next(error);
  }
}

export async function completeTask(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.userId as number;
    const id = parseInt(req.params.id, 10);
    const taskId = parseInt(req.params.taskId, 10);
    const task = await projectsService.completeTask(userId, id, taskId);
    res.json(task);
  } catch (error) {
    next(error);
  }
}
