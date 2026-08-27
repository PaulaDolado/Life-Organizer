import { Response, NextFunction } from "express";
import { AuthRequest } from "../middlewares/authMiddleware";
import * as todayService from "../services/todayService";

export async function getToday(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.userId as number;
    const result = await todayService.getToday(userId);
    res.json(result);
  } catch (error) {
    next(error);
  }
}
