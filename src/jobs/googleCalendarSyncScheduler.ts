import cron, { ScheduledTask } from "node-cron";
import { syncAllConnectedUsers } from "../services/googleCalendarService";
import { logger } from "../utils/logger";

const CRON_EXPRESSION = "*/30 * * * *"; // cada 30 min — suficiente para una agenda personal, sin agotar la cuota de la API de Google

/**
 * Arranca el cron que mantiene sincronizados los eventos de Google Calendar de todos los
 * usuarios conectados, además de la sincronización manual (POST /integrations/google/sync). Igual
 * que goalExpiryScheduler/notificationScheduler, se llama solo desde `src/index.ts`, nunca desde
 * `app.ts` (para que los tests de integración, que importan `app.ts`, no levanten un cron real).
 */
export function startGoogleCalendarSyncScheduler(): ScheduledTask {
  logger.info(`📅 Scheduler de sincronización con Google Calendar activo (${CRON_EXPRESSION})`);
  return cron.schedule(CRON_EXPRESSION, () => {
    syncAllConnectedUsers().catch((error) => {
      logger.error("googleCalendarSyncScheduler: fallo en syncAllConnectedUsers", { error });
    });
  });
}
