import express, { Application } from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import swaggerUi from "swagger-ui-express";
import { env } from "./config/environment";
import { swaggerSpec } from "./config/swagger";
import routes from "./routes";
import { errorHandler, notFoundHandler } from "./middlewares/errorHandler";
import { logger } from "./utils/logger";

export function createApp(): Application {
  const app = express();

  // Necesario para que express-rate-limit identifique la IP real del cliente
  // detrás de un proxy inverso (Railway/Render), en vez de la IP del proxy.
  if (env.isProduction) {
    app.set("trust proxy", 1);
  }

  app.use(helmet());
  app.use(cors({ origin: env.cors.origin }));
  app.use(express.json({ limit: "100kb" }));
  app.use(
    morgan(env.isProduction ? "combined" : "dev", {
      stream: { write: (message: string) => logger.info(message.trim()) },
      skip: () => env.isTest,
    })
  );

  const limiter = rateLimit({
    windowMs: env.rateLimit.windowMs,
    max: env.rateLimit.max,
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => env.isTest,
  });
  app.use(limiter);

  // Límite más estricto en auth para dificultar fuerza bruta sobre login/register.
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => env.isTest,
    message: { error: "Demasiados intentos, inténtalo de nuevo más tarde" },
  });
  app.use("/auth", authLimiter);

  app.get("/health", (_req, res) => {
    res.json({ status: "OK" });
  });

  app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

  app.use(routes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

export const app = createApp();
