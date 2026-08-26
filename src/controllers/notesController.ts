import { Response, NextFunction } from "express";
import { AuthRequest } from "../middlewares/authMiddleware";
import * as notesService from "../services/notesService";

export async function listNotes(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.userId as number;
    const result = await notesService.listNotes(userId);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function createNote(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.userId as number;
    const note = await notesService.createNote(userId, req.body.content);
    res.status(201).json(note);
  } catch (error) {
    next(error);
  }
}

export async function updateNote(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.userId as number;
    const id = parseInt(req.params.id, 10);
    const note = await notesService.updateNote(userId, id, req.body);
    res.json(note);
  } catch (error) {
    next(error);
  }
}

export async function deleteNote(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.userId as number;
    const id = parseInt(req.params.id, 10);
    await notesService.deleteNote(userId, id);
    res.json({ message: "Nota eliminada" });
  } catch (error) {
    next(error);
  }
}
