// Cliente REST directo para "Horario" — a diferencia de Agenda/Planificador/Hoy, este módulo NO
// pasa por SQLite ni por `src/sync/`: Schedule/ScheduleRow no forman parte del contrato de sync
// offline del backend (ni siquiera aparecen en la lista de "pendiente de sincronizar" de
// API.md — nunca se contempló, ver mobile/README.md). Igual que la propia web (que tampoco
// cachea Horario en ningún sitio), esta pantalla necesita conexión: lee y escribe directamente
// contra `/schedule` en cada acción, replicando uno a uno los métodos que
// `dashboard/src/pages/SchedulePage.tsx` ya usa contra la misma API.
import { api } from "./client";

export interface Schedule {
  id: number;
  name: string;
  order: number;
  createdAt: string;
  updatedAt: string;
}

export type DayKey = "monday" | "tuesday" | "wednesday" | "thursday" | "friday";

export interface ScheduleRow {
  id: number;
  order: number;
  timeLabel: string;
  monday: string;
  tuesday: string;
  wednesday: string;
  thursday: string;
  friday: string;
}

export const DAY_LABELS: Record<DayKey, string> = {
  monday: "Lunes",
  tuesday: "Martes",
  wednesday: "Miércoles",
  thursday: "Jueves",
  friday: "Viernes",
};
export const DAY_KEYS: DayKey[] = ["monday", "tuesday", "wednesday", "thursday", "friday"];

export async function listSchedules(): Promise<Schedule[]> {
  const res = await api.get<{ schedules: Schedule[] }>("/schedule");
  return res.schedules;
}

export const createSchedule = (name: string) => api.post<Schedule>("/schedule", { name });
export const renameSchedule = (id: number, name: string) => api.put<Schedule>(`/schedule/${id}`, { name });
export const deleteSchedule = (id: number) => api.delete<{ message: string }>(`/schedule/${id}`);
export const moveSchedule = (id: number, direction: "up" | "down") =>
  api.put<Schedule>(`/schedule/${id}/move`, { direction });

export async function listRows(scheduleId: number): Promise<ScheduleRow[]> {
  const res = await api.get<{ rows: ScheduleRow[] }>(`/schedule/${scheduleId}/rows`);
  return res.rows;
}

export const addRow = (scheduleId: number) => api.post<ScheduleRow>(`/schedule/${scheduleId}/rows`, {});

export const updateRow = (scheduleId: number, rowId: number, patch: Partial<Record<DayKey | "timeLabel", string>>) =>
  api.put<ScheduleRow>(`/schedule/${scheduleId}/rows/${rowId}`, patch);

export const deleteRow = (scheduleId: number, rowId: number) => api.delete<{ message: string }>(`/schedule/${scheduleId}/rows/${rowId}`);

export const moveRow = (scheduleId: number, rowId: number, direction: "up" | "down") =>
  api.put<ScheduleRow>(`/schedule/${scheduleId}/rows/${rowId}/move`, { direction });
