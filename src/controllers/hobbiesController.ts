import { Response, NextFunction } from "express";
import { AuthRequest } from "../middlewares/authMiddleware";
import * as hobbiesService from "../services/hobbiesService";

export async function listHobbies(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.userId as number;
    const { page, limit } = req.query as unknown as { page: number; limit: number };
    const result = await hobbiesService.listHobbies(userId, page, limit);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function listByCategory(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.userId as number;
    const { category } = req.params;
    const { page, limit } = req.query as unknown as { page: number; limit: number };
    const result = await hobbiesService.listByCategory(userId, category, page, limit);
    res.json({ category, ...result });
  } catch (error) {
    next(error);
  }
}

export async function createHobby(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.userId as number;
    const hobby = await hobbiesService.createHobby(userId, req.body);
    res.status(201).json(hobby);
  } catch (error) {
    next(error);
  }
}

export async function updateHobby(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.userId as number;
    const id = parseInt(req.params.id, 10);
    const hobby = await hobbiesService.updateHobby(userId, id, req.body);
    res.json(hobby);
  } catch (error) {
    next(error);
  }
}

export async function deleteHobby(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.userId as number;
    const id = parseInt(req.params.id, 10);
    await hobbiesService.deleteHobby(userId, id);
    res.json({ message: "Hobby eliminado" });
  } catch (error) {
    next(error);
  }
}

export async function addSession(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.userId as number;
    const id = parseInt(req.params.id, 10);
    const session = await hobbiesService.addSession(userId, id, req.body);
    res.status(201).json(session);
  } catch (error) {
    next(error);
  }
}

export async function getAnalytics(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.userId as number;
    const id = parseInt(req.params.id, 10);
    const analytics = await hobbiesService.getHobbyAnalytics(userId, id);
    res.json(analytics);
  } catch (error) {
    next(error);
  }
}
