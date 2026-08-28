import { openDatabaseAsync, type SQLiteDatabase } from "expo-sqlite";
import { initSchema } from "./schema";

let dbPromise: Promise<SQLiteDatabase> | null = null;

// Conexión única y perezosa (se abre y se crea el schema la primera vez que se usa) — igual de
// simple que el `prisma` compartido del backend, adaptado a que aquí no hay un proceso de
// arranque separado del propio render de la app.
export function getDb(): Promise<SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = openDatabaseAsync("life-organizer.db").then(async (db) => {
      await initSchema(db);
      return db;
    });
  }
  return dbPromise;
}
