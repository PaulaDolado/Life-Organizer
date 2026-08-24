import { PrismaClient } from "@prisma/client";
import { env } from "./environment";

// Evita crear múltiples instancias de PrismaClient en desarrollo (hot-reload)
declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

export const prisma =
  global.__prisma ??
  new PrismaClient({
    log: env.isProduction ? ["error", "warn"] : ["error", "warn"],
  });

if (!env.isProduction) {
  global.__prisma = prisma;
}
