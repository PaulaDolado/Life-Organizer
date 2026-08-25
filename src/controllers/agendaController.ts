import { Response, NextFunction } from "express";
import { AuthRequest } from "../middlewares/authMiddleware";
import * as agendaService from "../services/agendaService";

export async function getAgendaDay(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.userId as number;
    const { date } = req.params;
    const { type, page, limit } = req.query as unknown as { type?: string; page: number; limit: number };
    const result = await agendaService.getDay(userId, date, { type, page, limit });
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function getAgendaWeek(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.userId as number;
    const { date } = req.params;
    const { type, page, limit } = req.query as unknown as { type?: string; page: number; limit: number };
    const result = await agendaService.getWeek(userId, date, { type, page, limit });
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function createEvent(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.userId as number;
    const event = await agendaService.createEvent(userId, req.body);
    res.status(201).json(event);
  } catch (error) {
    next(error);
  }
}

export async function updateEvent(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.userId as number;
    const id = parseInt(req.params.id, 10);
    const event = await agendaService.updateEvent(userId, id, req.body);
    res.json(event);
  } catch (error) {
    next(error);
  }
}

export async function deleteEvent(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.userId as number;
    const id = parseInt(req.params.id, 10);
    await agendaService.deleteEvent(userId, id);
    res.json({ message: "Evento eliminado" });
  } catch (error) {
    next(error);
  }
}
