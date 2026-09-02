import { type SQLiteDatabase } from "expo-sqlite";

// Espejo local (SQLite) del subconjunto de datos que la app necesita offline. Ver el comentario
// de cada tabla en types.ts para el porqué de cada columna — en resumen:
// - events/tasks/subtasks: el móvil puede CREAR filas nuevas → mismo patrón que `notes` ya usaba
//   en Fase 1 (id TEXT = uuid hasta sincronizar, luego id de servidor; `synced` + `pendingOp`).
// - event_exceptions/habits: solo caché de lectura, se sobrescriben en cada pull, sin `dirty`.
// - habit_logs: clave compuesta (habitId, date) — igual que en el propio servidor, así que ni
//   siquiera hace falta un id local generado por el cliente (ver sync/push.ts).
export async function initSchema(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS sync_meta (
      key TEXT PRIMARY KEY,
      value TEXT
    );

    CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      type TEXT NOT NULL,
      startTime TEXT NOT NULL,
      endTime TEXT NOT NULL,
      location TEXT,
      isRecurring INTEGER NOT NULL DEFAULT 0,
      recurringPattern TEXT,
      reminderMinutesBefore TEXT NOT NULL DEFAULT '[]',
      guests TEXT NOT NULL DEFAULT '[]',
      source TEXT NOT NULL DEFAULT 'tidely',
      googleEventId TEXT,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      synced INTEGER NOT NULL DEFAULT 0,
      pendingOp TEXT
    );

    CREATE TABLE IF NOT EXISTS event_exceptions (
      eventId TEXT NOT NULL,
      originalStartTime TEXT NOT NULL,
      serverId INTEGER,
      status TEXT NOT NULL,
      newStartTime TEXT,
      newEndTime TEXT,
      updatedAt TEXT NOT NULL,
      PRIMARY KEY (eventId, originalStartTime)
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      plannerId INTEGER,
      projectId INTEGER,
      title TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'todo',
      priority TEXT NOT NULL DEFAULT 'medium',
      "order" REAL NOT NULL DEFAULT 0,
      dueDate TEXT,
      tags TEXT NOT NULL DEFAULT '[]',
      estimatedMinutes INTEGER,
      actualMinutes INTEGER NOT NULL DEFAULT 0,
      updatedAt TEXT NOT NULL,
      synced INTEGER NOT NULL DEFAULT 0,
      pendingOp TEXT
    );

    CREATE TABLE IF NOT EXISTS subtasks (
      id TEXT PRIMARY KEY,
      taskId TEXT NOT NULL,
      title TEXT NOT NULL,
      completed INTEGER NOT NULL DEFAULT 0,
      updatedAt TEXT NOT NULL,
      synced INTEGER NOT NULL DEFAULT 0,
      pendingOp TEXT
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
