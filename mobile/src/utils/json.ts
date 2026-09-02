// Los arrays que llegan del servidor (tags, guests, reminderMinutesBefore) se guardan en SQLite
// como TEXT con JSON.stringify — SQLite no tiene tipo array nativo, mismo criterio que
// `Task.tags`/`Event.guests` en Postgres se guardan como columnas nativas pero aquí no hay
// equivalente. `parseJsonArray` nunca lanza: una fila corrupta o un valor legacy inesperado
// degrada a lista vacía en vez de romper la pantalla entera.
export function parseJsonArray<T>(raw: string | null | undefined): T[] {
  if (!raw) return [];
  try {
    const value = JSON.parse(raw);
    return Array.isArray(value) ? (value as T[]) : [];
  } catch {
    return [];
  }
}

export function toJsonArray(value: unknown[] | null | undefined): string {
  return JSON.stringify(value ?? []);
}
