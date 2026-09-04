// Cliente REST directo para la leyenda del calendario anual (Horario > vista anual) — mismo
// criterio que api/schedule.ts: no pasa por SQLite ni por src/sync/, replica uno a uno los
// métodos que dashboard/src/components/AnnualCalendarLegend.tsx ya usa contra la misma API.
import { api } from "./client";
import { CalendarColor, CalendarDayMark, CalendarLegendCategory } from "../types";

export async function listCategories(): Promise<CalendarLegendCategory[]> {
  const res = await api.get<{ categories: CalendarLegendCategory[] }>("/calendar-legend");
  return res.categories;
}

export const createCategory = (label: string, color: CalendarColor) =>
  api.post<CalendarLegendCategory>("/calendar-legend", { label, color });

export const renameCategory = (id: number, label: string) => api.put<CalendarLegendCategory>(`/calendar-legend/${id}`, { label });

export const changeCategoryColor = (id: number, color: CalendarColor) =>
  api.put<CalendarLegendCategory>(`/calendar-legend/${id}`, { color });

export const deleteCategory = (id: number) => api.delete<{ message: string }>(`/calendar-legend/${id}`);

export async function listMarks(from: string, to: string): Promise<CalendarDayMark[]> {
  const res = await api.get<{ marks: CalendarDayMark[] }>(`/calendar-legend/marks?from=${from}&to=${to}`);
  return res.marks;
}

export const setDayMark = (date: string, categoryId: number | null) =>
  api.put<{ date: string; categoryId: number | null }>(`/calendar-legend/marks/${date}`, { categoryId });
