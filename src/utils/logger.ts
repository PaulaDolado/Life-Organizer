import winston from "winston";
import { env } from "../config/environment";

export const logger = winston.createLogger({
  level: env.isProduction ? "info" : "debug",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    env.isProduction ? winston.format.json() : winston.format.simple()
  ),
  transports: [new winston.transports.Console()],
  silent: env.isTest,
});
