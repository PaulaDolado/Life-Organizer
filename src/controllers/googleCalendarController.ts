import { Response, NextFunction, Request } from "express";
import { AuthRequest } from "../middlewares/authMiddleware";
import { env } from "../config/environment";
import { logger } from "../utils/logger";
import * as googleCalendarService from "../services/googleCalendarService";

export async function getStatus(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.userId as number;
    const status = await googleCalendarService.getStatus(userId);
    res.json(status);
  } catch (error) {
    next(error);
  }
}

export async function getConnectUrl(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.userId as number;
    const url = googleCalendarService.getAuthUrl(userId);
    res.json({ url });
  } catch (error) {
    next(error);
  }
}

/**
 * Ruta PÚBLICA (sin authMiddleware, ver googleCalendar.routes): el navegador llega aquí
 * redirigido directamente por Google tras el consentimiento, no como un fetch autenticado de la
 * SPA. Por eso no responde JSON — redirige de vuelta al dashboard (que no tiene router real, ver
 * App.tsx) con `?google=connected` o `?google=error` en la query, para que AgendaPage lo recoja.
 */
export async function handleCallback(req: Request, res: Response): Promise<void> {
  const { code, state, error } = req.query as { code?: string; state?: string; error?: string };
  const redirectBase = env.cors.origin === "*" ? "http://localhost:5173" : env.cors.origin;

  if (error || !code || !state) {
    res.redirect(`${redirectBase}/?google=error`);
    return;
  }

  try {
    await googleCalendarService.handleOAuthCallback(code, state);
    res.redirect(`${redirectBase}/?google=connected`);
  } catch (err) {
    logger.error("googleCalendarController.handleCallback: fallo procesando el callback de Google", { error: err });
    res.redirect(`${redirectBase}/?google=error`);
  }
}

export async function sync(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.userId as number;
    const result = await googleCalendarService.syncEvents(userId);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function disconnect(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.userId as number;
    await googleCalendarService.disconnect(userId);
    res.json({ disconnected: true });
  } catch (error) {
    next(error);
  }
}
