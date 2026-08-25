import { ReactNode, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useFetch } from "../hooks/useFetch";
import { api } from "../api/client";
import { AgendaResponse, Notification } from "../types";

export type Tab = "agenda" | "metas" | "finanzas" | "finanzas-ahorro" | "proyectos" | "hobbies";

interface NavItem {
  key: Tab;
  label: string;
  children?: NavItem[];
}

const NAV: NavItem[] = [
  { key: "agenda", label: "Agenda" },
  { key: "metas", label: "Metas" },
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
  children: ReactNode;
}

export function AppShell({ activeTab, onTabChange, children }: AppShellProps) {
  const { user, logout } = useAuth();
  const { data: week } = useFetch(() => api.get<AgendaResponse>(`/agenda/week/${todayIso()}`), []);

  const now = Date.now();
  const next = week?.events
    .filter((e) => new Date(e.startTime).getTime() >= now)
    .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())[0];

  return (
    <div className="flex min-h-screen bg-background font-sans text-foreground">
      <aside className="sticky top-0 hidden h-screen w-72 shrink-0 flex-col gap-10 border-r border-border p-8 lg:flex">
        <div className="flex items-center gap-3">
          <div className="size-8 rounded-full bg-primary" />
          <span className="text-xl font-semibold tracking-tight">Life Organizer</span>
        </div>

        <nav className="flex flex-col gap-1">
          {NAV.map((item) => (
            <div key={item.key}>
              <button
                onClick={() => onTabChange(item.key)}
                className={`w-full rounded-lg px-3 py-2 text-left transition-colors ${
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
                      className={`w-full rounded-lg px-3 py-1.5 text-left text-sm transition-colors ${
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
                <p className="font-medium">{next.title}</p>
                <p className="text-sm text-muted-foreground">
                  {new Date(next.startTime).toLocaleDateString("es-ES", { weekday: "short", day: "numeric" })} —{" "}
                  {new Date(next.startTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Nada pendiente. Respira.</p>
            )}
          </div>

          <div className="flex items-center justify-between rounded-2xl px-1 text-sm">
            <span className="truncate text-muted-foreground">{user?.name}</span>
            <button onClick={logout} className="cursor-pointer text-xs font-medium text-muted-foreground hover:text-destructive">
              Salir
            </button>
          </div>
        </div>
      </aside>

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
    </div>
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
