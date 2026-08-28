import { ReactNode, useEffect, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useFetch } from "../hooks/useFetch";
import { api } from "../api/client";
import { ProfileDialog } from "./ProfileDialog";
import { AgendaResponse, Notification, SearchResults } from "../types";

export type Tab = "hoy" | "agenda" | "planificador" | "horario" | "metas" | "finanzas" | "finanzas-ahorro" | "proyectos" | "hobbies";

// A dónde navegar y qué destacar al hacer clic en un resultado de búsqueda global — cada página
// destino decide qué hacer con `id` (abrir el diálogo, expandir la tarjeta, etc.) y llama a
// `onFocusHandled` cuando ya lo ha consumido, para no repetirlo en cada re-render.
export interface SearchFocus {
  type: "event" | "task" | "note" | "project";
  id: number;
  startTime?: string; // solo eventos: para saltar a la semana correcta antes de abrir el diálogo
}

interface NavItem {
  key: Tab;
  label: string;
  children?: NavItem[];
}

const NAV: NavItem[] = [
  { key: "hoy", label: "Hoy" },
  {
    key: "agenda",
    label: "Agenda",
    children: [
      { key: "planificador", label: "Planificador" },
      { key: "horario", label: "Horario" },
    ],
  },
  { key: "metas", label: "Objetivos" },
  {
    key: "finanzas",
    label: "Finanzas",
    children: [{ key: "finanzas-ahorro", label: "Metas de ahorro" }],
  },
  { key: "proyectos", label: "Proyectos" },
  { key: "hobbies", label: "Hobbies" },
];

// Nav aplanado — para el menú horizontal en móvil, donde anidar no tiene mucho sitio.
const FLAT_NAV: NavItem[] = NAV.flatMap((item) => [item, ...(item.children ?? [])]);

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

interface AppShellProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
  onSearchNavigate: (tab: Tab, focus: SearchFocus) => void;
  children: ReactNode;
}

const SIDEBAR_COLLAPSED_KEY = "life-organizer:sidebar-collapsed";
const SIDEBAR_WIDTH_KEY = "life-organizer:sidebar-width";
const DEFAULT_SIDEBAR_WIDTH = 288; // w-72, el ancho original
const MAX_SIDEBAR_WIDTH = 480;
// Padding horizontal del <aside> (p-8 = 2rem por lado) que hay que sumar al ancho del texto.
const SIDEBAR_PADDING_X = 64;

export function AppShell({ activeTab, onTabChange, onSearchNavigate, children }: AppShellProps) {
  const { user, logout } = useAuth();
  const [profileOpen, setProfileOpen] = useState(false);
  const { data: week } = useFetch(() => api.get<AgendaResponse>(`/agenda/week/${todayIso()}`), []);
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "true");
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const stored = Number(localStorage.getItem(SIDEBAR_WIDTH_KEY));
    return stored > 0 ? stored : DEFAULT_SIDEBAR_WIDTH;
  });
  // Ancho mínimo = el que ocupa el apartado más largo sin cortarse, medido de verdad en el DOM
  // (ver measureRef más abajo) en vez de un número fijo — así si cambian las etiquetas del menú,
  // el mínimo se sigue ajustando solo.
  const [minWidth, setMinWidth] = useState(DEFAULT_SIDEBAR_WIDTH);
  const measureRef = useRef<HTMLDivElement>(null);
  const resizingRef = useRef(false);

  const toggleCollapsed = () => {
    setCollapsed((v) => {
      const next = !v;
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(next));
      return next;
    });
  };

  // Mide el ancho natural (sin cortar) del apartado más largo del menú.
  useEffect(() => {
    const measure = () => {
      if (!measureRef.current) return;
      const width = Math.ceil(measureRef.current.scrollWidth) + SIDEBAR_PADDING_X;
      setMinWidth(width);
      setSidebarWidth((w) => Math.max(w, width));
    };
    measure();
    // Las fuentes (Outfit, vía Google Fonts) pueden tardar en cargar; re-medir cuando estén
    // listas evita que el mínimo se calcule corto con la fuente de reserva del sistema.
    document.fonts?.ready?.then(measure).catch(() => {});
  }, []);

  const startResize = (e: React.MouseEvent) => {
    e.preventDefault();
    resizingRef.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  };

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!resizingRef.current) return;
      setSidebarWidth(Math.min(MAX_SIDEBAR_WIDTH, Math.max(minWidth, e.clientX)));
    };
    const onMouseUp = () => {
      if (!resizingRef.current) return;
      resizingRef.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      setSidebarWidth((w) => {
        localStorage.setItem(SIDEBAR_WIDTH_KEY, String(w));
        return w;
      });
    };
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [minWidth]);

  const now = Date.now();
  const next = week?.events
    .filter((e) => new Date(e.startTime).getTime() >= now)
    .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())[0];

  return (
    <div className="flex min-h-screen bg-background font-sans text-foreground">
      {/* Clon invisible del nav, sin ancho forzado, solo para medir cuánto ocupa el apartado
          más largo sin cortarse (measureRef.current.scrollWidth en el efecto de arriba). */}
      <div ref={measureRef} aria-hidden className="invisible fixed left-0 top-0 -z-10 flex w-max flex-col items-start gap-1">
        {NAV.map((item) => (
          <div key={item.key} className="flex w-full flex-col items-start gap-1">
            <span className="whitespace-nowrap rounded-lg px-3 py-2 text-left font-medium">{item.label}</span>
            {item.children && (
              <div className="ml-3 flex flex-col items-start gap-1 border-l border-border pl-3">
                {item.children.map((child) => (
                  <span key={child.key} className="whitespace-nowrap rounded-lg px-3 py-1.5 text-left text-sm font-medium">
                    {child.label}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="hidden shrink-0 lg:flex">
        {!collapsed && (
          <div className="relative shrink-0" style={{ width: sidebarWidth }}>
            <aside className="sticky top-0 flex h-screen w-full flex-col gap-10 border-r border-border p-8">
              <div className="flex items-center gap-3">
                <div className="size-8 shrink-0 rounded-full bg-primary" />
                <span className="truncate text-xl font-semibold tracking-tight">Life Organizer</span>
              </div>

              <GlobalSearch onNavigate={onSearchNavigate} />

              <nav className="flex flex-col gap-1">
                {NAV.map((item) => (
                  <div key={item.key}>
                    <button
                      onClick={() => onTabChange(item.key)}
                      className={`w-full truncate rounded-lg px-3 py-2 text-left transition-colors ${
                        activeTab === item.key
                          ? "bg-primary/10 font-medium text-primary"
                          : "text-muted-foreground hover:bg-foreground/5"
                      }`}
                    >
                      {item.label}
                    </button>
                    {item.children && (
                      <div className="ml-3 mt-1 flex flex-col gap-1 border-l border-border pl-3">
                        {item.children.map((child) => (
                          <button
                            key={child.key}
                            onClick={() => onTabChange(child.key)}
                            className={`w-full truncate rounded-lg px-3 py-1.5 text-left text-sm transition-colors ${
                              activeTab === child.key
                                ? "bg-primary/10 font-medium text-primary"
                                : "text-muted-foreground hover:bg-foreground/5"
                            }`}
                          >
                            {child.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </nav>

              <div className="mt-auto space-y-4">
                <NotificationsWidget />

                <div className="rounded-2xl border border-secondary bg-secondary/30 p-4">
                  <p className="mb-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">Próximo evento</p>
                  {next ? (
                    <>
                      <p className="truncate font-medium">{next.title}</p>
                      <p className="truncate text-sm text-muted-foreground">
                        {new Date(next.startTime).toLocaleDateString("es-ES", { weekday: "short", day: "numeric" })} —{" "}
                        {new Date(next.startTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">Nada pendiente. Respira.</p>
                  )}
                </div>

                <div className="flex items-center justify-between rounded-2xl px-1 text-sm">
                  <button
                    onClick={() => setProfileOpen(true)}
                    title="Editar perfil"
                    className="min-w-0 flex-1 cursor-pointer text-left text-muted-foreground hover:text-foreground"
                  >
                    <span className="block truncate">{user?.name}</span>
                    {/* El "nombre de usuario" es el email de acceso, no un alias aparte. */}
                    {user?.email && <span className="block truncate text-xs opacity-70">{user.email}</span>}
                  </button>
                  <button
                    onClick={logout}
                    className="shrink-0 cursor-pointer text-xs font-medium text-muted-foreground hover:text-destructive"
                  >
                    Salir
                  </button>
                </div>
              </div>
            </aside>

            {/* Asa para ajustar el ancho arrastrando — no puede bajar de minWidth (el ancho
                natural del apartado más largo), así el texto nunca se corta. */}
            <div
              onMouseDown={startResize}
              role="separator"
              aria-orientation="vertical"
              aria-label="Ajustar ancho del menú"
              className="absolute right-0 top-0 z-10 h-full w-1.5 cursor-col-resize hover:bg-primary/30 active:bg-primary/40"
            />
          </div>
        )}

        {/* Pestaña siempre visible para esconder/mostrar el menú, aunque esté colapsado. */}
        <button
          onClick={toggleCollapsed}
          aria-label={collapsed ? "Mostrar menú" : "Ocultar menú"}
          title={collapsed ? "Mostrar menú" : "Ocultar menú"}
          className="sticky top-1/2 z-10 flex h-16 w-4 shrink-0 -translate-y-1/2 cursor-pointer items-center justify-center self-start rounded-r-full border border-l-0 border-border bg-card text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          {collapsed ? "›" : "‹"}
        </button>
      </div>

      <div className="flex-1">
        <nav className="flex gap-1 overflow-x-auto border-b border-border px-6 py-4 lg:hidden">
          {FLAT_NAV.map((item) => (
            <button
              key={item.key}
              onClick={() => onTabChange(item.key)}
              className={`whitespace-nowrap rounded-lg px-3 py-2 text-sm ${
                activeTab === item.key ? "bg-primary/10 font-medium text-primary" : "text-muted-foreground"
              }`}
            >
              {item.label}
            </button>
          ))}
          <button onClick={logout} className="ml-auto whitespace-nowrap rounded-lg px-3 py-2 text-sm text-muted-foreground">
            Salir
          </button>
        </nav>
        <main className="p-6 lg:p-12">{children}</main>
      </div>

      {profileOpen && <ProfileDialog onClose={() => setProfileOpen(false)} />}
    </div>
  );
}

const SEARCH_DEBOUNCE_MS = 300;

/**
 * Búsqueda global entre eventos, tareas, notas y proyectos. Al elegir un resultado, navega a
 * la sección correspondiente y le pasa un `SearchFocus` — cada página destino decide qué hacer
 * con él (abrir el diálogo del evento, expandir la tarjeta de la tarea, abrir el cuaderno del
 * proyecto...), ver `DashboardPage`.
 */
function GlobalSearch({ onNavigate }: { onNavigate: (tab: Tab, focus: SearchFocus) => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const data = await api.get<SearchResults>(`/search?q=${encodeURIComponent(trimmed)}`);
        setResults(data);
      } finally {
        setLoading(false);
      }
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  // Cierra el desplegable al clicar fuera.
  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const pick = (tab: Tab, focus: SearchFocus) => {
    onNavigate(tab, focus);
    setOpen(false);
    setQuery("");
    setResults(null);
  };

  const hasResults =
    results && (results.events.length > 0 || results.tasks.length > 0 || results.notes.length > 0 || results.projects.length > 0);

  return (
    <div ref={containerRef} className="relative">
      <input
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder="🔎 Buscar en todo..."
        className="field-input w-full text-sm"
      />

      {open && query.trim().length >= 2 && (
        <div className="absolute left-0 top-full z-20 mt-2 max-h-96 w-full overflow-y-auto rounded-2xl border border-border bg-card p-2 shadow-[var(--shadow-soft)]">
          {loading ? (
            <p className="p-3 text-center text-xs text-muted-foreground">Buscando...</p>
          ) : !hasResults ? (
            <p className="p-3 text-center text-xs text-muted-foreground">Sin resultados para "{query.trim()}".</p>
          ) : (
            <div className="space-y-3">
              {results!.events.length > 0 && (
                <SearchGroup label="Eventos">
                  {results!.events.map((e) => (
                    <SearchResultRow
                      key={`event-${e.id}`}
                      title={e.title}
                      subtitle={`${new Date(e.startTime).toLocaleDateString("es-ES", { day: "numeric", month: "short" })}${e.isRecurring ? " · recurrente" : ""}`}
                      onClick={() => pick("agenda", { type: "event", id: e.id, startTime: e.startTime })}
                    />
                  ))}
                </SearchGroup>
              )}
              {results!.tasks.length > 0 && (
                <SearchGroup label="Tareas">
                  {results!.tasks.map((t) => (
                    <SearchResultRow key={`task-${t.id}`} title={t.title} onClick={() => pick("planificador", { type: "task", id: t.id })} />
                  ))}
                </SearchGroup>
              )}
              {results!.notes.length > 0 && (
                <SearchGroup label="Notas">
                  {results!.notes.map((n) => (
                    <SearchResultRow key={`note-${n.id}`} title={n.content} onClick={() => pick("agenda", { type: "note", id: n.id })} />
                  ))}
                </SearchGroup>
              )}
              {results!.projects.length > 0 && (
                <SearchGroup label="Proyectos">
                  {results!.projects.map((p) => (
                    <SearchResultRow key={`project-${p.id}`} title={p.title} onClick={() => pick("proyectos", { type: "project", id: p.id })} />
                  ))}
                </SearchGroup>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SearchGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className="px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{label}</p>
      <ul>{children}</ul>
    </div>
  );
}

function SearchResultRow({ title, subtitle, onClick }: { title: string; subtitle?: string; onClick: () => void }) {
  return (
    <li>
      <button onClick={onClick} className="w-full cursor-pointer truncate rounded-xl px-2 py-1.5 text-left text-sm hover:bg-muted">
        {title}
        {subtitle && <span className="ml-2 text-xs text-muted-foreground">{subtitle}</span>}
      </button>
    </li>
  );
}

function NotificationsWidget() {
  const [open, setOpen] = useState(false);
  const { data, reload } = useFetch(
    () => api.get<{ notifications: Notification[] }>("/notifications?unreadOnly=true&limit=5"),
    []
  );
  const { data: countData, reload: reloadCount } = useFetch(
    () => api.get<{ unreadCount: number }>("/notifications/unread-count"),
    []
  );
  const unread = countData?.unreadCount ?? 0;

  const markAllRead = async () => {
    await api.put("/notifications/read-all");
    reload();
    reloadCount();
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between rounded-2xl border border-border bg-card px-4 py-3 text-sm transition-colors hover:border-primary/30"
      >
        <span className="flex items-center gap-2">
          <span aria-hidden="true">🔔</span> Notificaciones
        </span>
        {unread > 0 && (
          <span className="flex size-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
            {unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute bottom-full left-0 z-10 mb-2 w-full rounded-2xl border border-border bg-card p-3 shadow-[var(--shadow-soft)]">
          {(data?.notifications.length ?? 0) === 0 ? (
            <p className="p-3 text-center text-xs text-muted-foreground">Sin notificaciones nuevas.</p>
          ) : (
            <>
              <ul className="max-h-64 space-y-2 overflow-y-auto">
                {data?.notifications.map((n) => (
                  <li key={n.id} className="rounded-xl bg-muted/60 p-3 text-xs">
                    <p className="font-medium">{n.title}</p>
                    <p className="mt-1 text-muted-foreground">{n.message}</p>
                  </li>
                ))}
              </ul>
              <button onClick={markAllRead} className="mt-2 w-full rounded-xl py-2 text-center text-xs text-primary hover:underline">
                Marcar todas como leídas
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle: string; action?: ReactNode }) {
  return (
    <header className="mb-12 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="mb-2 font-serif text-4xl">{title}</h1>
        <p className="text-muted-foreground">{subtitle}</p>
      </div>
      {action}
    </header>
  );
}
