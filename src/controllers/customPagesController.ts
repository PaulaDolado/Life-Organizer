import { Response, NextFunction } from "express";
import { AuthRequest } from "../middlewares/authMiddleware";
import * as customPagesService from "../services/customPagesService";

export async function listCustomPages(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.userId as number;
    const result = await customPagesService.listCustomPages(userId);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function createCustomPage(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.userId as number;
    const page = await customPagesService.createCustomPage(userId, req.body.title, req.body.template);
    res.status(201).json(page);
  } catch (error) {
    next(error);
  }
}

export async function getCustomPage(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.userId as number;
    const id = parseInt(req.params.id, 10);
    const page = await customPagesService.getCustomPage(userId, id);
    res.json(page);
  } catch (error) {
    next(error);
  }
}

export async function updateCustomPage(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.userId as number;
    const id = parseInt(req.params.id, 10);
    const page = await customPagesService.updateCustomPage(userId, id, req.body);
    res.json(page);
  } catch (error) {
    next(error);
  }
}

export async function deleteCustomPage(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.userId as number;
    const id = parseInt(req.params.id, 10);
    await customPagesService.deleteCustomPage(userId, id);
    res.json({ message: "Página eliminada" });
  } catch (error) {
    next(error);
  }
}

export async function moveCustomPage(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.userId as number;
    const id = parseInt(req.params.id, 10);
    await customPagesService.moveCustomPage(userId, id, req.body.direction);
    res.json({ message: "Página movida" });
  } catch (error) {
    next(error);
  }
}
