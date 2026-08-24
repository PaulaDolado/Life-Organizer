import { Response, NextFunction } from "express";
import { AuthRequest } from "../middlewares/authMiddleware";
import * as financeService from "../services/financeService";

export async function getMonthlyBalance(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.userId as number;
    const month = parseInt(req.params.month, 10);
    const year = parseInt(req.params.year, 10);
    const result = await financeService.getMonthlyBalance(userId, month, year);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function getAnnualBalance(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.userId as number;
    const year = parseInt(req.params.year, 10);
    const result = await financeService.getAnnualBalance(userId, year);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function listTransactions(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.userId as number;
    const { type, category, from, to, page, limit } = req.query as unknown as {
      type?: string;
      category?: string;
      from?: string;
      to?: string;
      page: number;
      limit: number;
    };
    const result = await financeService.listTransactions(userId, { type, category, from, to, page, limit });
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function createTransaction(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.userId as number;
    const transaction = await financeService.createTransaction(userId, req.body);
    res.status(201).json(transaction);
  } catch (error) {
    next(error);
  }
}

export async function updateTransaction(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.userId as number;
    const id = parseInt(req.params.id, 10);
    const transaction = await financeService.updateTransaction(userId, id, req.body);
    res.json(transaction);
  } catch (error) {
    next(error);
  }
}

export async function deleteTransaction(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.userId as number;
    const id = parseInt(req.params.id, 10);
    await financeService.deleteTransaction(userId, id);
    res.json({ message: "Transacción eliminada" });
  } catch (error) {
    next(error);
  }
}

export async function listSavingsGoals(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.userId as number;
    const goals = await financeService.listSavingsGoals(userId);
    res.json({ savingsGoals: goals });
  } catch (error) {
    next(error);
  }
}

export async function createSavingsGoal(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.userId as number;
    const goal = await financeService.createSavingsGoal(userId, req.body);
    res.status(201).json(goal);
  } catch (error) {
    next(error);
  }
}

export async function getAnalytics(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.userId as number;
    const { month, year } = req.query as unknown as { month?: number; year?: number };
    const result = await financeService.getAnalytics(userId, month, year);
    res.json(result);
  } catch (error) {
    next(error);
  }
}
