import cron, { ScheduledTask } from "node-cron";
import { createEventReminders, createGoalRiskAlerts } from "../services/notificationService";
import { logger } from "../utils/logger";

const CRON_EXPRESSION = "*/5 * * * *"; // cada 5 minutos

async function runChecks(): Promise<void> {
  try {
    await createEventReminders();
  } catch (error) {
    logger.error("notificationScheduler: fallo en createEventReminders", { error });
  }

  try {
    await createGoalRiskAlerts();
  } catch (error) {
    logger.error("notificationScheduler: fallo en createGoalRiskAlerts", { error });
  }
}

/**
 * Arranca el cron de notificaciones (recordatorios de eventos + alertas de metas en riesgo).
 * Se llama solo desde `src/index.ts` (el entry point real), nunca desde `app.ts` — así los
 * tests de integración (que importan `app.ts` vía Supertest) nunca levantan un cron de fondo
 * por accidente.
 */
export function startNotificationScheduler(): ScheduledTask {
  logger.info(`🔔 Scheduler de notificaciones activo (${CRON_EXPRESSION})`);
  return cron.schedule(CRON_EXPRESSION, () => {
    void runChecks();
  });
}
