import { Request, Response, NextFunction } from "express";
import { Prisma } from "@prisma/client";
import { AppError } from "../utils/errorHandler";
import { logger } from "../utils/logger";
import { env } from "../config/environment";

/** Middleware de manejo de errores centralizado. Debe registrarse el último, tras todas las rutas. */
export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  next: NextFunction
): void {
  if (err instanceof AppError) {
    if (!err.isOperational) {
      logger.error(err.message, { stack: err.stack });
    }
    res.status(err.statusCode).json({ error: err.message });
    return;
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") {
      res.status(409).json({ error: "El recurso ya existe (violación de restricción única)" });
      return;
    }
    if (err.code === "P2025") {
      res.status(404).json({ error: "Recurso no encontrado" });
      return;
    }
  }

  logger.error(err.message, { stack: err.stack });
  res.status(500).json({
    error: "Error interno del servidor",
    ...(env.isProduction ? {} : { detail: err.message }),
  });
}

/** Middleware para rutas no encontradas (404). Debe registrarse tras todas las rutas. */
export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({ error: `Ruta no encontrada: ${req.method} ${req.originalUrl}` });
}
