import { Response, NextFunction } from "express";
import { AuthRequest } from "../middlewares/authMiddleware";
import * as searchService from "../services/searchService";

export async function search(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.userId as number;
    const { q } = req.query as unknown as { q: string };
    const result = await searchService.search(userId, q);
    res.json(result);
  } catch (error) {
    next(error);
  }
}
