import { useState } from "react";
import { QUICK_ACCESS_APPS, QuickAccessApp, openQuickAccessApp } from "../utils/quickAccessApps";

// Solo local: qué apps mostrar es una preferencia de ESTE dispositivo (abrir la app de
// escritorio solo tiene sentido en el ordenador donde se hace clic), igual que el resto de
// preferencias de interfaz que ya viven en localStorage (sidebar colapsado, modo de vista del
// horario — ver AppShell/SchedulePage). Nada de esto se manda al backend.
const STORAGE_KEY = "life-organizer:quick-access";
const DEFAULT_IDS = ["whatsapp", "spotify", "github", "gitlab", "gmail", "teams"];

function loadSelectedIds(): string[] {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return DEFAULT_IDS;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((id) => typeof id === "string") : DEFAULT_IDS;
  } catch {
    return DEFAULT_IDS;
  }
}

export function QuickAccessCard() {
  const [selectedIds, setSelectedIds] = useState<string[]>(loadSelectedIds);
  const [editing, setEditing] = useState(false);

  const toggle = (id: string) => {
    const next = selectedIds.includes(id) ? selectedIds.filter((x) => x !== id) : [...selectedIds, id];
    setSelectedIds(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  };

  const selectedApps = QUICK_ACCESS_APPS.filter((app) => selectedIds.includes(app.id));

  return (
    <div className="rounded-3xl border border-primary/30 bg-primary/10 p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xs font-bold uppercase tracking-widest text-primary">🔗 Acceso rápido</h2>
        <button onClick={() => setEditing(true)} className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
          Editar
        </button>
      </div>

      {selectedApps.length === 0 ? (
        <p className="text-sm text-muted-foreground">Sin apps seleccionadas todavía.</p>
      ) : (
        <div className="grid grid-cols-4 gap-3 sm:grid-cols-5">
          {selectedApps.map((app) => (
            <button
              key={app.id}
              onClick={() => openQuickAccessApp(app)}
              title={app.appUrl ? `Abrir ${app.label} (app o web)` : `Abrir ${app.label} (web)`}
              className="flex cursor-pointer flex-col items-center gap-1.5 rounded-xl p-1.5 text-center transition-colors hover:bg-background/60"
            >
              <AppLogo app={app} size={11} />
              <span className="w-full truncate text-[10px] text-muted-foreground">{app.label}</span>
            </button>
          ))}
        </div>
      )}

      {editing && <QuickAccessEditDialog selectedIds={selectedIds} onToggle={toggle} onClose={() => setEditing(false)} />}
    </div>
  );
}

// Logo oficial de la marca (ver quickAccessApps.ts) sobre una casilla de su color, en blanco —
// mismo tratamiento que un icono de acceso directo del sistema operativo. `size` en unidades de
// Tailwind (size-11 = 2.75rem, size-8 = 2rem), reutilizado en la tarjeta y en el diálogo de
// selección con dos tamaños distintos.
function AppLogo({ app, size }: { app: QuickAccessApp; size: 8 | 11 }) {
  const boxClass = size === 11 ? "size-11 rounded-2xl p-2" : "size-8 rounded-lg p-1.5";
  return (
    <span className={`flex shrink-0 items-center justify-center ${boxClass}`} style={{ backgroundColor: app.color }}>
      <svg viewBox="0 0 24 24" fill="#fff" role="img" aria-label={app.label}>
        <path d={app.icon} />
      </svg>
    </span>
  );
}

// Diálogo de selección — simple lista de checkboxes sobre el catálogo fijo (ver
// quickAccessApps.ts), mismo estilo de diálogo modal que el resto de la app (fixed inset-0 +
// panel rounded-3xl).
function QuickAccessEditDialog({
  selectedIds,
  onToggle,
  onClose,
}: {
  selectedIds: string[];
  onToggle: (id: string) => void;
  onClose: () => void;
}) {
  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/50 p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-sm rounded-3xl bg-card p-6 shadow-[var(--shadow-soft)]">
        <div className="mb-1 flex items-center justify-between gap-4">
          <h3 className="font-serif text-xl">Acceso rápido</h3>
          <button type="button" onClick={onClose} className="shrink-0 cursor-pointer text-xs text-muted-foreground hover:text-foreground">
            ✕ Cerrar
          </button>
        </div>
        <p className="mb-4 text-xs text-muted-foreground">Elige qué apps quieres ver como accesos directos en "Hoy".</p>

        <ul className="max-h-80 space-y-1 overflow-y-auto">
          {QUICK_ACCESS_APPS.map((app) => (
            <li key={app.id}>
              <label className="flex cursor-pointer items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-muted">
                <input
                  type="checkbox"
                  checked={selectedIds.includes(app.id)}
                  onChange={() => onToggle(app.id)}
                  className="size-4 shrink-0 cursor-pointer accent-primary"
                />
                <AppLogo app={app} size={8} />
                <span className="min-w-0 flex-1 truncate text-sm">{app.label}</span>
              </label>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
