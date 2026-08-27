import { RecentProjectEntry } from "../types";

// "hace 5 min" / "hace 3h" / "ayer" / "27 ago" — igual de reciente que la propia ventana de
// 7 días que usa el backend (ver projectsService.listRecentEntries), así que nunca hace falta
// más granularidad que "ayer".
function formatRelative(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffMin = Math.round(diffMs / 60000);
  if (diffMin < 1) return "ahora mismo";
  if (diffMin < 60) return `hace ${diffMin} min`;
  const diffHours = Math.round(diffMin / 60);
  if (diffHours < 24) return `hace ${diffHours}h`;
  const diffDays = Math.round(diffHours / 24);
  if (diffDays === 1) return "ayer";
  return new Date(iso).toLocaleDateString("es-ES", { day: "numeric", month: "short" });
}

function RecentEntryRow({ entry, onOpen }: { entry: RecentProjectEntry; onOpen: () => void }) {
  return (
    <li>
      <button
        onClick={onOpen}
        className="flex w-full cursor-pointer flex-col gap-1 rounded-xl border border-border px-4 py-2.5 text-left transition-colors hover:border-primary/30"
      >
        <div className="flex items-center justify-between gap-2">
          <span className="flex min-w-0 items-center gap-1.5 text-sm font-medium">
            <span className="truncate">{entry.pageTitle}</span>
            <span className="shrink-0 text-xs font-normal text-muted-foreground">· {entry.projectTitle}</span>
          </span>
          <span className="shrink-0 text-xs text-muted-foreground">{formatRelative(entry.updatedAt)}</span>
        </div>
        {entry.preview && <p className="truncate text-xs text-muted-foreground">{entry.preview}</p>}
      </button>
    </li>
  );
}

/**
 * Últimas páginas de libreta tocadas (ver projectsService.listRecentEntries) — aparece en la
 * vista Hoy y en la Agenda (debajo de Hábitos diarios), compartido para no duplicar el marcado
 * ni el formateo de fecha relativa. Sin estado "vacío": si no hay entradas, simplemente no
 * renderiza nada (cada página decide si eso implica ocultar todo el hueco o no).
 */
export function RecentEntriesCard({ entries, onOpenProject }: { entries: RecentProjectEntry[]; onOpenProject: (projectId: number) => void }) {
  if (entries.length === 0) return null;

  return (
    <section className="rounded-3xl border border-border bg-card p-6">
      <h2 className="mb-4 text-xs font-bold uppercase tracking-widest text-muted-foreground">📓 Entradas recientes en tus libretas</h2>
      <ul className="flex flex-col gap-2">
        {entries.map((entry) => (
          <RecentEntryRow key={entry.id} entry={entry} onOpen={() => onOpenProject(entry.projectId)} />
        ))}
      </ul>
    </section>
  );
}
