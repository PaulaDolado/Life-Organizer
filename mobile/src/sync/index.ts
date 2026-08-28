import { pushToServer } from "./push";
import { pullFromServer } from "./pull";

export interface SyncResult {
  success: boolean;
  error?: string;
  at: string;
}

/** Sube antes de bajar: así, cuando el pull llega, el cursor guardado sigue siendo el de ANTES
 * de este push (se actualiza al final del propio pull) — por eso el pull de este mismo ciclo
 * incluye también los cambios que el push acaba de confirmar (p.ej. el `serverId` real de un
 * HabitLog creado offline, ver habitsRepo.upsertHabitLogs). Si el push falla (sin conexión, p.
 * ej.), no se intenta el pull — mejor no traer nada que traer un estado a medias. */
export async function runSync(): Promise<SyncResult> {
  try {
    await pushToServer();
    await pullFromServer();
    return { success: true, at: new Date().toISOString() };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Error de sincronización", at: new Date().toISOString() };
  }
}
