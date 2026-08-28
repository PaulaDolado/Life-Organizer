import { Response, NextFunction } from "express";
import { AuthRequest } from "../middlewares/authMiddleware";
import * as linkPreviewService from "../services/linkPreviewService";

export async function getPreview(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { url } = req.query as { url: string };
    const preview = await linkPreviewService.fetchLinkPreview(url);
    res.json(preview);
  } catch (error) {
    next(error);
  }
}
