import { type SQLiteDatabase } from "expo-sqlite";

// Espejo local (SQLite) del subconjunto de datos que la pantalla "Hoy" necesita offline. Ver
// el comentario de cada tabla en types.ts para el porqué de cada columna — en resumen:
// - events/habits: solo caché de lectura, se sobrescriben en cada pull, sin `dirty`.
// - tasks: se edita el `status` desde el móvil (marcar hecha) → `dirty` marca "pendiente de subir".
// - habit_logs: clave compuesta (habitId, date) — igual que en el propio servidor, así que ni
//   siquiera hace falta un id local generado por el cliente (ver sync/push.ts).
// - notes: la única tabla donde el móvil CREA filas nuevas → necesita el baile de id
//   local(uuid)→id de servidor (columna `synced`, ver types.ts).
export async function initSchema(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS sync_meta (
      key TEXT PRIMARY KEY,
      value TEXT
    );

    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY,
      title TEXT NOT NULL,
      type TEXT NOT NULL,
      startTime TEXT NOT NULL,
      endTime TEXT NOT NULL,
      location TEXT,
      updatedAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY,
      title TEXT NOT NULL,
      status TEXT NOT NULL,
      dueDate TEXT,
      updatedAt TEXT NOT NULL,
      dirty INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS habits (
      id INTEGER PRIMARY KEY,
      title TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS habit_logs (
      habitId INTEGER NOT NULL,
      date TEXT NOT NULL,
      serverId INTEGER,
      pending TEXT,
      PRIMARY KEY (habitId, date)
    );

    CREATE TABLE IF NOT EXISTS notes (
      id TEXT PRIMARY KEY,
      content TEXT NOT NULL,
      checked INTEGER NOT NULL DEFAULT 0,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      synced INTEGER NOT NULL DEFAULT 0,
      pendingOp TEXT
    );
  `);
}
