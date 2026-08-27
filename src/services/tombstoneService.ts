import { Prisma } from "@prisma/client";

/**
 * Rastro de un borrado para la sincronización offline del móvil (ver syncService.ts) — los
 * deletes de esta app son siempre hard deletes, así que sin esto un cliente que llevara tiempo
 * desconectado nunca se enteraría de que una fila desapareció. Se llama SIEMPRE dentro del mismo
 * `prisma.$transaction` que el propio delete (ver los `deleteX` de agendaService/plannerService/
 * notesService/habitsService), para que borrar la fila y dejar constancia sean atómicos — o
 * pasan las dos, o no pasa ninguna.
 *
 * `entityType` es el mismo vocabulario que usa `syncService`: "event" | "eventException" |
 * "task" | "subtask" | "note" | "habit" | "habitLog".
 */
export function recordTombstone(
  tx: Prisma.TransactionClient,
  userId: number,
  entityType: string,
  entityId: number
): Prisma.PrismaPromise<{ id: number }> {
  return tx.syncTombstone.create({ data: { userId, entityType, entityId }, select: { id: true } });
}
