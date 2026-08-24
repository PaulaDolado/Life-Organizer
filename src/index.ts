import { app } from "./app";
import { env } from "./config/environment";
import { logger } from "./utils/logger";

app.listen(env.port, () => {
  logger.info(`🚀 Servidor en http://localhost:${env.port}`);
  logger.info(`📄 Swagger docs en http://localhost:${env.port}/api-docs`);
});
