// Tipos compartidos por la app móvil. Deliberadamente más pequeños que los del dashboard web
// (dashboard/src/types.ts) — Fase 1 solo cachea/edita el subconjunto que la pantalla "Hoy"
// necesita (ver el plan en README.md), no todos los campos que expone la API.

export interface User {
  id: number;
  email: string;
  name: string;
  timezone?: string;
}

export interface AuthResponse {
  token: string;
  refreshToken: string;
  user: User;
}

// --- Filas tal cual las devuelve el servidor (GET /sync/pull) ---
// Son los modelos de Prisma "en crudo", no las respuestas ya elaboradas de /agenda, /planner,
// etc. — por eso llevan `userId` y no atraviesan ningún check de "pertenece al proyecto X".

export interface ServerEvent {
  id: number;
  title: string;
  type: string;
  startTime: string;
  endTime: string;
  location: string | null;
  updatedAt: string;
}

export interface ServerTask {
  id: number;
  title: string;
  status: "todo" | "in_progress" | "done";
  dueDate: string | null;
  updatedAt: string;
}

export interface ServerHabit {
  id: number;
  title: string;
  active: boolean;
  updatedAt: string;
}

export interface ServerHabitLog {
  id: number;
  habitId: number;
  date: string;
  createdAt: string;
}

export interface ServerNote {
  id: number;
  content: string;
  checked: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SyncTombstone {
  id: number;
  entityType: "event" | "eventException" | "task" | "subtask" | "note" | "habit" | "habitLog";
  entityId: number;
  deletedAt: string;
}

export interface PullResponse {
  serverTime: string;
  events: ServerEvent[];
  tasks: ServerTask[];
  notes: ServerNote[];
  habits: ServerHabit[];
  habitLogs: ServerHabitLog[];
  tombstones: SyncTombstone[];
  // `eventExceptions` y `subtasks` también vienen en la respuesta (protocolo genérico pensado
  // para futuras fases) pero esta fase de la app no los usa ni los guarda localmente.
}

export interface PushResult {
  idMappings: { entityType: string; localId: string; id: number }[];
  conflicts: { entityType: string; id: number }[];
}

// --- Filas tal cual se guardan en SQLite local (ver db/schema.ts) ---

export interface LocalEvent {
  id: number;
  title: string;
  type: string;
  startTime: string;
  endTime: string;
  location: string | null;
  updatedAt: string;
}

export interface LocalTask {
  id: number;
  title: string;
  status: "todo" | "in_progress" | "done";
  dueDate: string | null;
  updatedAt: string;
  dirty: 0 | 1; // 1 = estado cambiado offline, pendiente de subir
}

export interface LocalHabit {
  id: number;
  title: string;
  updatedAt: string;
}

export interface LocalHabitLog {
  habitId: number;
  date: string;
  serverId: number | null; // null hasta que un pull confirma el id real (ver sync/push.ts)
  pending: "create" | "delete" | null; // null = confirmado con el servidor
}

export interface LocalNote {
  id: string; // uuid mientras no está sincronizada; id del servidor (como texto) en cuanto lo está
  content: string;
  checked: 0 | 1;
  createdAt: string;
  updatedAt: string;
  synced: 0 | 1;
  pendingOp: "update" | "delete" | null; // "create" está implícito en synced = 0
}
