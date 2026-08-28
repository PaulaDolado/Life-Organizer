import { getDb } from "./index";

const CURSOR_KEY = "cursor";

/** Cursor del último `pull` (el `serverTime` que devolvió) — `null` si nunca se ha sincronizado
 * (próximo pull = bootstrap completo, ver syncService.ts en el backend). */
export async function getCursor(): Promise<string | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ value: string }>("SELECT value FROM sync_meta WHERE key = ?", [CURSOR_KEY]);
  return row?.value ?? null;
}

export async function setCursor(serverTime: string): Promise<void> {
  const db = await getDb();
  await db.runAsync("INSERT OR REPLACE INTO sync_meta (key, value) VALUES (?, ?)", [CURSOR_KEY, serverTime]);
}
