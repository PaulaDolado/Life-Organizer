import { app } from "./app";
import { env } from "./config/environment";
import { logger } from "./utils/logger";
import { startNotificationScheduler } from "./jobs/notificationScheduler";
import { startGoalExpiryScheduler } from "./jobs/goalExpiryScheduler";
import { startGoogleCalendarSyncScheduler } from "./jobs/googleCalendarSyncScheduler";

app.listen(env.port, () => {
  logger.info(`🚀 Servidor en http://localhost:${env.port}`);
  logger.info(`📄 Swagger docs en http://localhost:${env.port}/api-docs`);
});

startNotificationScheduler();
startGoalExpiryScheduler();
startGoogleCalendarSyncScheduler();
