import { openDatabaseAsync, type SQLiteDatabase } from "expo-sqlite";
import { initSchema } from "./schema";

let dbPromise: Promise<SQLiteDatabase> | null = null;

// Conexión única y perezosa (se abre y se crea el schema la primera vez que se usa) — igual de
// simple que el `prisma` compartido del backend, adaptado a que aquí no hay un proceso de
// arranque separado del propio render de la app.
export function getDb(): Promise<SQLiteDatabase> {
  if (!dbPromise) {
    // v2 del esquema (Agenda + Planificador, ver mobile/README.md): `events`/`tasks` cambian de
    // INTEGER a TEXT como clave primaria (mismo patrón que `notes`, para poder crearse offline).
    // Fase 1 nunca se probó en un dispositivo real, así que no hay instalaciones que migrar — un
    // nombre de fichero nuevo basta para que cualquier dev con la BD vieja arranque en limpio.
    dbPromise = openDatabaseAsync("life-organizer-v2.db").then(async (db) => {
      await initSchema(db);
      return db;
    });
  }
  return dbPromise;
}
