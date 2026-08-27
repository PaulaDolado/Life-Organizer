import { useEffect, useMemo, useRef, useState } from "react";
import { PageHeader, SearchFocus, Tab } from "../components/AppShell";
import { api } from "../api/client";
import { useFetch } from "../hooks/useFetch";
import { Loading, ErrorMessage } from "../components/Feedback";
import { GoalsDonutChart, GOALS_DONUT_PALETTE } from "../components/GoalsDonutChart";
import { HabitsTrackerCard } from "../components/HabitsTrackerCard";
import { QuickNotesCard } from "../components/QuickNotesCard";
import { RecentEntriesCard } from "../components/RecentEntriesCard";
import {
  AgendaResponse,
  Event,
  EventType,
  FreeTimeResponse,
  Goal,
  Habit,
  IcsImportResult,
  Note,
  RecentProjectEntry,
  RecurringPattern,
} from "../types";

const DAY_LABELS = ["LUN", "MAR", "MIÉ", "JUE", "VIE", "SÁB", "DOM"];
const TYPES: { value: EventType; label: string }[] = [
  { value: "work", label: "Trabajo" },
  { value: "study", label: "Estudio" },
  { value: "gym", label: "Gimnasio" },
  { value: "meeting", label: "Reunión" },
  { value: "free", label: "Libre" },
];
const RECURRENCES: { value: RecurringPattern; label: string }[] = [
  { value: "weekly", label: "Cada semana" },
  { value: "biweekly", label: "Cada 2 semanas" },
  { value: "monthly", label: "Cada mes" },
];
// Antelaciones de aviso ofrecidas en el formulario — el backend admite cualquier valor entre
// 1 min y 1 semana, pero un puñado de presets cubre el caso de uso real sin abrumar la UI.
const REMINDER_PRESETS: { minutes: number; label: string }[] = [
  { minutes: 15, label: "15 min antes" },
  { minutes: 30, label: "30 min antes" },
  { minutes: 60, label: "1 hora antes" },
  { minutes: 1440, label: "1 día antes" },
];

// Estilo por tipo de evento: usado como acento de la tarjeta en el bloque semanal.
const TYPE_STYLES: Record<string, string> = {
  work: "bg-primary/15 text-primary",
  study: "bg-secondary/70 text-foreground",
  gym: "bg-hobby/15 text-hobby",
  meeting: "bg-warning/15 text-warning",
  free: "bg-muted text-muted-foreground",
};
const DEFAULT_TYPE_STYLE = "bg-muted text-muted-foreground";
const TYPE_LABELS: Record<string, string> = {
  work: "Trabajo",
  study: "Estudio",
  gym: "Gimnasio",
  meeting: "Reunión",
  free: "Libre",
};

type ViewMode = "week" | "month";

function toKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function dayKeyOf(event: Event): string {
  return event.startTime.slice(0, 10);
}

// Aritmética de calendario PURA en UTC — nunca mezclar con métodos locales (getDate/setDate)
// aquí: si se parseara `${key}T00:00:00` sin "Z", `new Date` lo interpreta como medianoche
// LOCAL del navegador, y para una timezone por delante de UTC (p.ej. GMT+2) esa medianoche
// local cae en el día UTC ANTERIOR — `toKey` (que sí usa toISOString/UTC) devolvería `key`
// desplazado un día incluso con delta=0. Parsear y desplazar siempre en UTC evita el desfase.
function addDays(key: string, delta: number): string {
  const d = new Date(`${key}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return toKey(d);
}

// Fecha/hora locales (no UTC) de un ISO string, para precargar los inputs del formulario
// con los mismos valores "de pared" que el usuario introdujo al crear el evento.
function localDateOf(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function localTimeOf(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

// Traslada un evento a otro día de calendario conservando la hora y duración originales —
// usado por el drag-and-drop de reprogramar (semana y mes).
function shiftEventToDay(event: Event, targetDayKey: string): { startTime: string; endTime: string } {
  const origStart = new Date(event.startTime);
  const origEnd = new Date(event.endTime);
  const durationMs = origEnd.getTime() - origStart.getTime();

  const [y, m, d] = targetDayKey.split("-").map(Number);
  const newStart = new Date(origStart);
  newStart.setFullYear(y, m - 1, d);
  return { startTime: newStart.toISOString(), endTime: new Date(newStart.getTime() + durationMs).toISOString() };
}

export function AgendaPage({
  focusEventId,
  focusEventStartTime,
  onFocusHandled,
  onNavigate,
}: {
  // Llegada desde un resultado de la búsqueda global (ver AppShell.GlobalSearch): salta a la
  // semana de `focusEventStartTime` y abre el diálogo de ese evento en cuanto carguen sus datos.
  focusEventId?: number;
  focusEventStartTime?: string;
  onFocusHandled?: () => void;
  // Para abrir una libreta desde "Entradas recientes" (ver DashboardPage) — opcional porque
  // Agenda puede montarse sin ese contexto (tests, storybook-like usos sueltos).
  onNavigate?: (tab: Tab, focus?: SearchFocus) => void;
} = {}) {
  const [viewMode, setViewMode] = useState<ViewMode>("week");
  const [selected, setSelected] = useState(() => (focusEventStartTime ? focusEventStartTime.slice(0, 10) : toKey(new Date())));
  const [open, setOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [showFreeTime, setShowFreeTime] = useState(false);

  const { data, loading, error, reload } = useFetch(
    () => (viewMode === "month" ? api.get<AgendaResponse>(`/agenda/month/${selected}`) : api.get<AgendaResponse>(`/agenda/week/${selected}`)),
    [selected, viewMode]
  );

  // Una vez cargada la semana de destino, abre el diálogo del evento buscado y avisa al padre
  // para que limpie el foco (no se repite en recargas posteriores ni si el usuario navega a mano).
  useEffect(() => {
    if (!focusEventId || !onFocusHandled) return;
    const match = data?.events.find((e) => e.id === focusEventId);
    if (match) {
      setEditingEvent(match);
      onFocusHandled();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusEventId, data?.events]);

  const { data: goalsData } = useFetch(() => api.get<{ goals: Goal[] }>("/goals?status=active"), []);
  const { data: habitsData, reload: reloadHabits } = useFetch(() => api.get<{ habits: Habit[] }>("/habits"), []);
  const { data: notesData, reload: reloadNotes } = useFetch(() => api.get<{ notes: Note[] }>("/notes"), []);
  const { data: recentEntriesData } = useFetch(() => api.get<{ entries: RecentProjectEntry[] }>("/projects/recent-entries"), []);

  // Los días de la cuadrícula se calculan a partir de `selected` (una fecha de calendario,
  // sin ambigüedad de zona horaria) — NO a partir de `data.weekStart`/`monthStart`, que son
  // instantes UTC reales: cuando la timezone del usuario va por delante de UTC (p.ej.
  // Europe/Madrid en verano, +2h), la medianoche local del lunes cae en el día UTC ANTERIOR
  // (23:00 del domingo), así que leer `getUTCDate()` sobre ese instante etiquetaría el lunes
  // como "domingo" — un día de desfase en toda la cuadrícula (y en el día de destino al
  // arrastrar una tarjeta). Estas fechas son "de calendario puro" a mediodía UTC, coherentes
  // con `dayKeyOf` (que hace lo mismo al trocear `event.startTime`).
  const week = useMemo(() => {
    if (viewMode !== "week") return [];
    const weekday = new Date(`${selected}T00:00:00.000Z`).getUTCDay();
    const isoWeekday = weekday === 0 ? 7 : weekday;
    const mondayKey = addDays(selected, -(isoWeekday - 1));
    return Array.from({ length: 7 }, (_, i) => new Date(`${addDays(mondayKey, i)}T00:00:00.000Z`));
  }, [viewMode, selected]);

  const month = useMemo(() => {
    if (viewMode !== "month") return [];
    const firstOfMonthKey = `${selected.slice(0, 7)}-01`;
    const startWeekday = new Date(`${firstOfMonthKey}T00:00:00.000Z`).getUTCDay();
    const startIsoWeekday = startWeekday === 0 ? 7 : startWeekday;
    const gridStartKey = addDays(firstOfMonthKey, -(startIsoWeekday - 1));

    const nextMonthFirst = new Date(`${firstOfMonthKey}T00:00:00.000Z`);
    nextMonthFirst.setUTCMonth(nextMonthFirst.getUTCMonth() + 1);
    const lastOfMonthKey = addDays(toKey(nextMonthFirst), -1);
    const endWeekday = new Date(`${lastOfMonthKey}T00:00:00.000Z`).getUTCDay();
    const endIsoWeekday = endWeekday === 0 ? 7 : endWeekday;
    const gridEndKey = addDays(lastOfMonthKey, 7 - endIsoWeekday);

    const days: Date[] = [];
    let cursorKey = gridStartKey;
    while (cursorKey <= gridEndKey) {
      days.push(new Date(`${cursorKey}T00:00:00.000Z`));
      cursorKey = addDays(cursorKey, 1);
    }
    return days;
  }, [viewMode, selected]);

  const today = toKey(new Date());
  const currentMonthKey = selected.slice(0, 7);

  const rangeLabel = useMemo(() => {
    const fmt = (d: Date) => d.toLocaleDateString("es-ES", { day: "numeric", month: "short", timeZone: "UTC" });
    if (viewMode === "week") {
      if (week.length === 0) return "";
      return `Semana del ${fmt(week[0])} – ${fmt(week[6])}`;
    }
    return new Date(`${selected.slice(0, 7)}-01T00:00:00.000Z`).toLocaleDateString("es-ES", {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    });
  }, [viewMode, week, selected]);

  const moveEventToDay = async (event: Event, targetDayKey: string) => {
    if (dayKeyOf(event) === targetDayKey) return;
    const { startTime, endTime } = shiftEventToDay(event, targetDayKey);
    if (event.isRecurringInstance) {
      // Un evento recurrente no se edita entero al arrastrar una tarjeta: se crea/actualiza
      // la excepción de ESA ocurrencia (identificada por originalStartTime), el resto de la
      // serie no se mueve.
      await api.post(`/agenda/events/${event.id}/exceptions`, {
        originalStartTime: event.originalStartTime,
        action: "moved",
        newStartTime: startTime,
        newEndTime: endTime,
      });
    } else {
      await api.put(`/agenda/events/${event.id}`, { startTime, endTime });
    }
    reload();
  };

  return (
    <>
      <PageHeader
        title="Agenda"
        subtitle={rangeLabel}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center overflow-hidden rounded-full border border-border">
              <button
                onClick={() => setViewMode("week")}
                className={`cursor-pointer px-3 py-2 text-xs font-medium transition-colors ${
                  viewMode === "week" ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted"
                }`}
              >
                Semana
              </button>
              <button
                onClick={() => setViewMode("month")}
                className={`cursor-pointer border-l border-border px-3 py-2 text-xs font-medium transition-colors ${
                  viewMode === "month" ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted"
                }`}
              >
                Mes
              </button>
            </div>
            <div className="flex items-center overflow-hidden rounded-full border border-border">
              <button
                onClick={() => setSelected((s) => addDays(s, viewMode === "month" ? -28 : -7))}
                className="cursor-pointer px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted"
                aria-label="Anterior"
              >
                ‹
              </button>
              <button
                onClick={() => setSelected(today)}
                className="cursor-pointer border-x border-border px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted"
              >
                Hoy
              </button>
              <button
                onClick={() => setSelected((s) => addDays(s, viewMode === "month" ? 28 : 7))}
                className="cursor-pointer px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted"
                aria-label="Siguiente"
              >
                ›
              </button>
            </div>
            <button onClick={() => setShowFreeTime((v) => !v)} className="cursor-pointer rounded-full border border-border px-3 py-2 text-xs text-muted-foreground transition-colors hover:bg-muted">
              {showFreeTime ? "Ocultar tiempo libre" : "⏱ Tiempo libre"}
            </button>
            <IcsMenu onImported={reload} />
            <button onClick={() => setOpen((v) => !v)} className="btn-dark">
              {open ? "Cerrar" : "+ Nuevo evento"}
            </button>
          </div>
        }
      />

      {open && (
        <NewEventForm
          date={selected}
          onSubmit={async (input) => {
            await api.post("/agenda/events", input);
            setOpen(false);
            reload();
          }}
        />
      )}

      {error && <ErrorMessage message={error} />}

      {showFreeTime && <FreeTimePanel date={selected} onScheduled={reload} />}

      <section className="mb-8">
        {loading ? (
          <Loading label="Cargando agenda..." />
        ) : viewMode === "week" ? (
          week.length > 0 && (
            <WeekTimeGrid week={week} events={data?.events ?? []} today={today} onSelect={setEditingEvent} onMoveToDay={moveEventToDay} />
          )
        ) : (
          month.length > 0 && (
            <MonthGrid
              days={month}
              events={data?.events ?? []}
              today={today}
              currentMonthKey={currentMonthKey}
              onSelect={setEditingEvent}
              onMoveToDay={moveEventToDay}
              onPickDay={(key) => {
                setSelected(key);
                setViewMode("week");
              }}
            />
          )
        )}
      </section>

      {/* Dos columnas parejas: Hábitos + Entradas recientes a la izquierda (flex-1), Objetivos +
          Notas rápidas a la derecha (lg:max-w-sm) — cada columna apilada, así Notas queda justo
          debajo de Objetivos en vez de suelta más abajo a todo lo ancho. */}
      <section className="mb-8 flex flex-col gap-6 lg:flex-row">
        <div className="flex flex-col gap-6 lg:flex-1">
          <HabitsTrackerCard habits={habitsData?.habits ?? []} onChanged={reloadHabits} />
          <RecentEntriesCard
            entries={recentEntriesData?.entries ?? []}
            onOpenProject={(projectId) => onNavigate?.("proyectos", { type: "project", id: projectId })}
          />
        </div>
        <div className="flex w-full flex-col gap-6 lg:max-w-sm">
          <GoalsProgressCard goals={goalsData?.goals ?? []} />
          <QuickNotesCard notes={notesData?.notes ?? []} onChanged={reloadNotes} />
        </div>
      </section>

      {editingEvent && (
        <EventDialog
          event={editingEvent}
          onClose={() => setEditingEvent(null)}
          onSaved={async (input) => {
            await api.put(`/agenda/events/${editingEvent.id}`, input);
            setEditingEvent(null);
            reload();
          }}
          onDeleted={async () => {
            await api.delete(`/agenda/events/${editingEvent.id}`);
            setEditingEvent(null);
            reload();
          }}
          onSetException={async (input) => {
            await api.post(`/agenda/events/${editingEvent.id}/exceptions`, input);
            setEditingEvent(null);
            reload();
          }}
          onRestoreOccurrence={async () => {
            await api.delete(`/agenda/events/${editingEvent.id}/exceptions/${editingEvent.originalStartTime}`);
            setEditingEvent(null);
            reload();
          }}
        />
      )}
    </>
  );
}

function EventCard({
  event,
  compact,
  onSelect,
  onDragStart,
  onDragEnd,
  draggedId,
}: {
  event: Event;
  compact?: boolean;
  onSelect: () => void;
  onDragStart: (e: React.DragEvent) => void;
  onDragEnd: () => void;
  draggedId: string | null;
}) {
  const dragKey = `${event.id}-${event.startTime}`;
  return (
    <button
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onSelect}
      className={`w-full cursor-grab rounded-xl border border-border bg-card px-2.5 py-2 text-left transition-colors hover:border-primary/30 active:cursor-grabbing ${
        draggedId === dragKey ? "opacity-40" : ""
      } ${compact ? "px-2 py-1" : ""}`}
    >
      <p className={`truncate font-medium ${compact ? "text-[11px]" : "text-xs"}`}>
        {event.title}
        {event.isRecurring && " ↻"}
        {event.isException && " ✎"}
      </p>
      {!compact && (
        <>
          <span
            className={`mt-1.5 inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${TYPE_STYLES[event.type] ?? DEFAULT_TYPE_STYLE}`}
          >
            {TYPE_LABELS[event.type] ?? event.type}
          </span>
          <p className="mt-1.5 text-[10px] text-muted-foreground">
            {new Date(event.startTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} –{" "}
            {new Date(event.endTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </p>
        </>
      )}
    </button>
  );
}

function WeekTimeGrid({
  week,
  events,
  today,
  onSelect,
  onMoveToDay,
}: {
  week: Date[];
  events: Event[];
  today: string;
  onSelect: (event: Event) => void;
  onMoveToDay: (event: Event, targetDayKey: string) => void;
}) {
  const [draggedKey, setDraggedKey] = useState<string | null>(null);
  const [dragOverKey, setDragOverKey] = useState<string | null>(null);

  const eventsByDragKey = useMemo(() => {
    const map = new Map<string, Event>();
    events.forEach((e) => map.set(`${e.id}-${e.startTime}`, e));
    return map;
  }, [events]);

  const handleDrop = (e: React.DragEvent, dayKey: string) => {
    e.preventDefault();
    setDragOverKey(null);
    const dragKey = e.dataTransfer.getData("text/plain");
    const event = eventsByDragKey.get(dragKey);
    if (event) onMoveToDay(event, dayKey);
  };

  return (
    <div className="overflow-x-auto rounded-3xl border border-border bg-card shadow-[var(--shadow-soft)]">
      <div className="grid min-w-[720px] grid-cols-7 divide-x divide-border">
        {week.map((d, i) => {
          const key = toKey(d);
          const isToday = key === today;
          const dayEvents = events.filter((e) => dayKeyOf(e) === key).sort((a, b) => a.startTime.localeCompare(b.startTime));

          return (
            <div
              key={key}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOverKey(key);
              }}
              onDragLeave={() => setDragOverKey((k) => (k === key ? null : k))}
              onDrop={(e) => handleDrop(e, key)}
              className={`flex flex-col transition-colors ${dragOverKey === key ? "bg-primary/5" : ""}`}
            >
              <div className="flex items-center justify-between px-3 py-2.5">
                <span className="text-xs font-medium text-muted-foreground">{DAY_LABELS[i]}</span>
                <span
                  className={`flex size-6 items-center justify-center rounded-full text-xs ${
                    isToday ? "bg-primary font-bold text-primary-foreground" : "text-foreground"
                  }`}
                >
                  {d.getUTCDate()}
                </span>
              </div>

              <div className="flex flex-1 flex-col gap-1.5 px-1.5 pb-2">
                {dayEvents.map((event) => {
                  const dragKey = `${event.id}-${event.startTime}`;
                  return (
                    <EventCard
                      key={dragKey}
                      event={event}
                      draggedId={draggedKey}
                      onSelect={() => onSelect(event)}
                      onDragStart={(e) => {
                        e.dataTransfer.setData("text/plain", dragKey);
                        setDraggedKey(dragKey);
                      }}
                      onDragEnd={() => setDraggedKey(null)}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MonthGrid({
  days,
  events,
  today,
  currentMonthKey,
  onSelect,
  onMoveToDay,
  onPickDay,
}: {
  days: Date[];
  events: Event[];
  today: string;
  currentMonthKey: string;
  onSelect: (event: Event) => void;
  onMoveToDay: (event: Event, targetDayKey: string) => void;
  onPickDay: (dayKey: string) => void;
}) {
  const [draggedKey, setDraggedKey] = useState<string | null>(null);
  const [dragOverKey, setDragOverKey] = useState<string | null>(null);
  const MAX_VISIBLE = 3;

  const eventsByDragKey = useMemo(() => {
    const map = new Map<string, Event>();
    events.forEach((e) => map.set(`${e.id}-${e.startTime}`, e));
    return map;
  }, [events]);

  const handleDrop = (e: React.DragEvent, dayKey: string) => {
    e.preventDefault();
    setDragOverKey(null);
    const dragKey = e.dataTransfer.getData("text/plain");
    const event = eventsByDragKey.get(dragKey);
    if (event) onMoveToDay(event, dayKey);
  };

  return (
    <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-[var(--shadow-soft)]">
      <div className="grid grid-cols-7 divide-x divide-border border-b border-border">
        {DAY_LABELS.map((label) => (
          <div key={label} className="px-3 py-2.5 text-center text-xs font-medium text-muted-foreground">
            {label}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 divide-x divide-y divide-border">
        {days.map((d) => {
          const key = toKey(d);
          const isToday = key === today;
          const inMonth = key.slice(0, 7) === currentMonthKey;
          const dayEvents = events.filter((e) => dayKeyOf(e) === key).sort((a, b) => a.startTime.localeCompare(b.startTime));
          const hidden = Math.max(0, dayEvents.length - MAX_VISIBLE);

          return (
            <div
              key={key}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOverKey(key);
              }}
              onDragLeave={() => setDragOverKey((k) => (k === key ? null : k))}
              onDrop={(e) => handleDrop(e, key)}
              className={`flex min-h-[7rem] flex-col gap-1 p-1.5 transition-colors ${
                dragOverKey === key ? "bg-primary/5" : ""
              } ${inMonth ? "" : "bg-muted/30"}`}
            >
              <button
                onClick={() => onPickDay(key)}
                className={`self-end flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-full text-xs transition-colors hover:bg-muted ${
                  isToday ? "bg-primary font-bold text-primary-foreground" : inMonth ? "text-foreground" : "text-muted-foreground/50"
                }`}
              >
                {d.getUTCDate()}
              </button>
              <div className="flex flex-col gap-1">
                {dayEvents.slice(0, MAX_VISIBLE).map((event) => {
                  const dragKey = `${event.id}-${event.startTime}`;
                  return (
                    <EventCard
                      key={dragKey}
                      event={event}
                      compact
                      draggedId={draggedKey}
                      onSelect={() => onSelect(event)}
                      onDragStart={(e) => {
                        e.dataTransfer.setData("text/plain", dragKey);
                        setDraggedKey(dragKey);
                      }}
                      onDragEnd={() => setDraggedKey(null)}
                    />
                  );
                })}
                {hidden > 0 && (
                  <button onClick={() => onPickDay(key)} className="cursor-pointer px-2 text-left text-[10px] text-muted-foreground hover:text-foreground">
                    +{hidden} más
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function FreeTimePanel({ date, onScheduled }: { date: string; onScheduled: () => void }) {
  const { data, loading, error, reload } = useFetch(() => api.get<FreeTimeResponse>(`/agenda/free-time/${date}`), [date]);

  const scheduleSuggestion = async (suggestion: FreeTimeResponse["suggestions"][number]) => {
    await api.post("/agenda/events", {
      title: suggestion.task.title,
      type: "work",
      startTime: suggestion.block.start,
      endTime: new Date(new Date(suggestion.block.start).getTime() + suggestion.task.estimatedMinutes * 60000).toISOString(),
    });
    reload();
    onScheduled();
  };

  const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  return (
    <section className="mb-8 rounded-3xl border border-border bg-card p-6">
      <h2 className="mb-1 text-xs font-medium uppercase tracking-widest text-muted-foreground">
        Tiempo libre · {new Date(`${date}T00:00:00`).toLocaleDateString("es-ES", { day: "numeric", month: "long" })}
      </h2>
      <p className="mb-4 text-xs text-muted-foreground">Huecos entre 08:00 y 22:00, con sugerencias del Planificador que encajan.</p>

      {loading ? (
        <Loading label="Calculando huecos..." />
      ) : error ? (
        <ErrorMessage message={error} />
      ) : (data?.freeBlocks.length ?? 0) === 0 ? (
        <p className="text-sm text-muted-foreground">Sin huecos ese día — agenda completa.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {data?.freeBlocks.map((block) => {
            const suggestion = data.suggestions.find((s) => s.block.start === block.start);
            return (
              <div key={block.start} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border px-4 py-2.5">
                <span className="text-sm">
                  {fmtTime(block.start)} – {fmtTime(block.end)}{" "}
                  <span className="text-xs text-muted-foreground">({block.durationMinutes} min libres)</span>
                </span>
                {suggestion ? (
                  <button
                    onClick={() => scheduleSuggestion(suggestion)}
                    className="cursor-pointer rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/20"
                  >
                    + Meter "{suggestion.task.title}" ({suggestion.task.estimatedMinutes} min)
                  </button>
                ) : (
                  <span className="text-xs text-muted-foreground/60">Sin tarea pendiente que encaje</span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

/**
 * Exportar/importar .ics: sincronizar con Google Calendar/Outlook. Exportar descarga un
 * archivo (blob + enlace temporal, ya que `fetch` con cabecera Authorization no puede ser una
 * navegación normal a `/agenda/ics`); importar lee el archivo elegido como texto en el propio
 * navegador y lo manda como JSON — no hace falta multipart para un solo archivo de texto.
 */
function IcsMenu({ onImported }: { onImported: () => void }) {
  const [busy, setBusy] = useState(false);
  const [importSummary, setImportSummary] = useState<IcsImportResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const exportIcs = async () => {
    setBusy(true);
    try {
      const text = await api.get<string>("/agenda/ics");
      const blob = new Blob([text], { type: "text/calendar;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "agenda.ics";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } finally {
      setBusy(false);
    }
  };

  const importIcs = async (file: File) => {
    setBusy(true);
    setImportSummary(null);
    try {
      const text = await file.text();
      const result = await api.post<IcsImportResult>("/agenda/ics/import", { ics: text });
      setImportSummary(result);
      onImported();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative">
      <div className="flex items-center overflow-hidden rounded-full border border-border">
        <button
          onClick={exportIcs}
          disabled={busy}
          title="Descargar tus eventos como .ics"
          className="cursor-pointer px-3 py-2 text-xs text-muted-foreground transition-colors hover:bg-muted disabled:opacity-50"
        >
          ⬇ .ics
        </button>
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={busy}
          title="Importar eventos desde un .ics"
          className="cursor-pointer border-l border-border px-3 py-2 text-xs text-muted-foreground transition-colors hover:bg-muted disabled:opacity-50"
        >
          ⬆ .ics
        </button>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept=".ics,text/calendar"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) importIcs(file);
          e.target.value = "";
        }}
      />

      {importSummary && (
        <div className="absolute right-0 top-full z-20 mt-2 w-64 rounded-2xl border border-border bg-card p-3 text-xs shadow-[var(--shadow-soft)]">
          <p className="mb-1 font-medium">Importación completada</p>
          <p className="text-muted-foreground">{importSummary.created} evento(s) creado(s)</p>
          {importSummary.importedAsSingleOccurrence > 0 && (
            <p className="text-muted-foreground">{importSummary.importedAsSingleOccurrence} con recurrencia no soportada (solo 1ª ocurrencia)</p>
          )}
          {importSummary.skippedUnparsable > 0 && <p className="text-muted-foreground">{importSummary.skippedUnparsable} ignorado(s) (sin fecha válida)</p>}
          <button onClick={() => setImportSummary(null)} className="mt-2 cursor-pointer text-primary hover:underline">
            Cerrar
          </button>
        </div>
      )}
    </div>
  );
}

interface EventInputFields {
  title: string;
  type: EventType;
  startTime: string;
  endTime: string;
  isRecurring: boolean;
  recurringPattern?: RecurringPattern;
  reminderMinutesBefore: number[];
  guests: string[];
}

function ReminderCheckboxes({ value, onChange }: { value: number[]; onChange: (minutes: number[]) => void }) {
  const toggle = (minutes: number) => {
    onChange(value.includes(minutes) ? value.filter((m) => m !== minutes) : [...value, minutes].sort((a, b) => a - b));
  };
  return (
    <div>
      <p className="mb-1.5 text-xs text-muted-foreground">Avisarme</p>
      <div className="flex flex-wrap gap-2">
        {REMINDER_PRESETS.map((preset) => (
          <label
            key={preset.minutes}
            className={`flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition-colors ${
              value.includes(preset.minutes) ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/30"
            }`}
          >
            <input type="checkbox" checked={value.includes(preset.minutes)} onChange={() => toggle(preset.minutes)} className="sr-only" />
            {preset.label}
          </label>
        ))}
      </div>
    </div>
  );
}

function GuestsEditor({ value, onChange }: { value: string[]; onChange: (guests: string[]) => void }) {
  const [draft, setDraft] = useState("");
  return (
    <div>
      <p className="mb-1.5 text-xs text-muted-foreground">Invitados</p>
      <div className="flex flex-wrap items-center gap-1.5">
        {value.map((guest) => (
          <span key={guest} className="flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground">
            {guest}
            <button type="button" onClick={() => onChange(value.filter((g) => g !== guest))} className="cursor-pointer hover:text-destructive" aria-label={`Quitar a ${guest}`}>
              ✕
            </button>
          </span>
        ))}
        {/* Div, no <form>: este editor vive DENTRO del <form> del evento (NewEventForm/EventDialog)
            — un <form> anidado es HTML inválido y el navegador lo "levanta" fuera de su sitio,
            así que el botón "OK" acababa enviando el formulario del evento entero en vez de
            solo añadir el invitado. type="button" + onClick evita cualquier semántica de envío. */}
        <div className="flex gap-1">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== "Enter") return;
              e.preventDefault();
              const trimmed = draft.trim();
              if (!trimmed || value.includes(trimmed)) return;
              onChange([...value, trimmed]);
              setDraft("");
            }}
            placeholder="+ nombre o email"
            className="field-input w-36 text-xs"
          />
          <button
            type="button"
            onClick={() => {
              const trimmed = draft.trim();
              if (!trimmed || value.includes(trimmed)) return;
              onChange([...value, trimmed]);
              setDraft("");
            }}
            className="cursor-pointer rounded-full border border-border px-2 text-xs text-muted-foreground hover:bg-muted"
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
}

function EventDialog({
  event,
  onClose,
  onSaved,
  onDeleted,
  onSetException,
  onRestoreOccurrence,
}: {
  event: Event;
  onClose: () => void;
  onSaved: (input: EventInputFields) => Promise<void>;
  onDeleted: () => Promise<void>;
  onSetException: (input: { originalStartTime?: string; action: "moved" | "cancelled"; newStartTime?: string; newEndTime?: string }) => Promise<void>;
  onRestoreOccurrence: () => Promise<void>;
}) {
  const [title, setTitle] = useState(event.title);
  const [eventDate, setEventDate] = useState(localDateOf(event.startTime));
  const [startTime, setStartTime] = useState(localTimeOf(event.startTime));
  const [endTime, setEndTime] = useState(localTimeOf(event.endTime));
  const [type, setType] = useState<EventType>(event.type as EventType);
  const [isRecurring, setIsRecurring] = useState(event.isRecurring ?? false);
  const [recurringPattern, setRecurringPattern] = useState<RecurringPattern>(event.recurringPattern ?? "weekly");
  const [reminderMinutesBefore, setReminderMinutesBefore] = useState<number[]>(event.reminderMinutesBefore ?? [30]);
  const [guests, setGuests] = useState<string[]>(event.guests ?? []);
  const [submitting, setSubmitting] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const buildTimes = () => ({
    startTime: new Date(`${eventDate}T${startTime}:00`).toISOString(),
    endTime: new Date(`${eventDate}T${endTime}:00`).toISOString(),
  });

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-foreground/50 p-4"
      onClick={onClose}
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={async (e) => {
          e.preventDefault();
          if (!title.trim()) return;
          setSubmitting(true);
          try {
            await onSaved({
              title: title.trim(),
              type,
              ...buildTimes(),
              isRecurring,
              ...(isRecurring ? { recurringPattern } : {}),
              reminderMinutesBefore,
              guests,
            });
          } finally {
            setSubmitting(false);
          }
        }}
        className="w-full max-w-md rounded-3xl bg-card p-6 shadow-[var(--shadow-soft)] sm:p-8"
      >
        <div className="mb-6 flex items-center justify-between">
          <h2 className="font-serif text-xl">Editar evento</h2>
          <button type="button" onClick={onClose} className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
            ✕ Cerrar
          </button>
        </div>

        {event.isRecurringInstance && (
          <p className="mb-4 rounded-xl bg-secondary/40 p-3 text-xs text-muted-foreground">
            Este evento pertenece a una serie recurrente. "Guardar cambios" afecta a toda la serie — usa los botones de abajo para
            {event.isException ? " restaurar" : " mover o cancelar"} solo esta ocurrencia.
          </p>
        )}

        <div className="grid gap-4">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="¿Qué necesitas hacer?" className="field-input" />
          <div className="grid grid-cols-3 gap-3">
            <input type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} className="field-input" />
            <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="field-input" />
            <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="field-input" />
          </div>
          <select value={type} onChange={(e) => setType(e.target.value as EventType)} className="field-input">
            {TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>

          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input type="checkbox" checked={isRecurring} onChange={(e) => setIsRecurring(e.target.checked)} />
            Evento recurrente
          </label>
          {isRecurring && (
            <select
              value={recurringPattern}
              onChange={(e) => setRecurringPattern(e.target.value as RecurringPattern)}
              className="field-input"
            >
              {RECURRENCES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          )}

          <ReminderCheckboxes value={reminderMinutesBefore} onChange={setReminderMinutesBefore} />
          <GuestsEditor value={guests} onChange={setGuests} />
        </div>

        {event.isRecurringInstance && (
          <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-4">
            {event.isException ? (
              <button type="button" onClick={onRestoreOccurrence} className="cursor-pointer rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted">
                Restaurar horario original
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => onSetException({ originalStartTime: event.originalStartTime, action: "moved", ...buildTimes() })}
                  className="cursor-pointer rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted"
                >
                  Mover solo esta vez
                </button>
                <button
                  type="button"
                  onClick={() => onSetException({ originalStartTime: event.originalStartTime, action: "cancelled" })}
                  className="cursor-pointer rounded-full border border-border px-3 py-1.5 text-xs text-destructive hover:bg-destructive/10"
                >
                  Cancelar solo esta vez
                </button>
              </>
            )}
          </div>
        )}

        <div className="mt-6 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => {
              if (!confirmingDelete) {
                setConfirmingDelete(true);
                return;
              }
              onDeleted();
            }}
            onBlur={() => setConfirmingDelete(false)}
            className={`cursor-pointer whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition-colors ${
              confirmingDelete
                ? "bg-destructive text-destructive-foreground"
                : "text-destructive hover:bg-destructive/10"
            }`}
          >
            {confirmingDelete ? "¿Confirmar eliminar?" : "Eliminar"}
          </button>
          <button type="submit" disabled={submitting} className="btn-primary">
            {submitting ? "Guardando..." : "Guardar cambios"}
          </button>
        </div>
      </form>
    </div>
  );
}

function GoalsProgressCard({ goals }: { goals: Goal[] }) {
  const percentOf = (goal: Goal) => (goal.targetValue > 0 ? Math.min(100, Math.round((goal.currentValue / goal.targetValue) * 100)) : 0);
  const overall = goals.length > 0 ? Math.round(goals.reduce((sum, g) => sum + percentOf(g), 0) / goals.length) : 0;

  return (
    <div className="rounded-3xl bg-primary p-8 text-primary-foreground">
      <h2 className="mb-6 text-xs uppercase tracking-widest opacity-60">Progreso de objetivos</h2>

      {goals.length === 0 ? (
        <p className="text-sm opacity-80">No tienes objetivos activos.</p>
      ) : (
        <div className="flex items-center gap-4">
          <GoalsDonutChart goals={goals} overallPercent={overall} />

          {/* Qué color del donut es cada objetivo: punto + nombre, al lado del donut. */}
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            {goals.map((goal, i) => (
              <span key={goal.id} className="flex min-w-0 items-center gap-1.5 text-xs">
                <span
                  className="size-2 shrink-0 rounded-full"
                  style={{ backgroundColor: GOALS_DONUT_PALETTE[i % GOALS_DONUT_PALETTE.length] }}
                  aria-hidden
                />
                <span className="truncate opacity-80">{goal.title}</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function NewEventForm({ date, onSubmit }: { date: string; onSubmit: (input: EventInputFields) => Promise<void> }) {
  const [title, setTitle] = useState("");
  const [eventDate, setEventDate] = useState(date);
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");
  const [type, setType] = useState<EventType>("work");
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurringPattern, setRecurringPattern] = useState<RecurringPattern>("weekly");
  const [reminderMinutesBefore, setReminderMinutesBefore] = useState<number[]>([30]);
  const [guests, setGuests] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        if (!title.trim()) return;
        setSubmitting(true);
        try {
          await onSubmit({
            title: title.trim(),
            type,
            startTime: new Date(`${eventDate}T${startTime}:00`).toISOString(),
            endTime: new Date(`${eventDate}T${endTime}:00`).toISOString(),
            isRecurring,
            ...(isRecurring ? { recurringPattern } : {}),
            reminderMinutesBefore,
            guests,
          });
          setTitle("");
        } finally {
          setSubmitting(false);
        }
      }}
      className="mb-10 grid gap-4 card-soft md:grid-cols-[2fr_1fr_1fr_1fr_1fr]"
    >
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="¿Qué necesitas hacer?" className="field-input" />
      <input type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} className="field-input" />
      <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="field-input" />
      <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="field-input" />
      <select value={type} onChange={(e) => setType(e.target.value as EventType)} className="field-input">
        {TYPES.map((t) => (
          <option key={t.value} value={t.value}>
            {t.label}
          </option>
        ))}
      </select>

      <label className="flex items-center gap-2 text-sm text-muted-foreground md:col-span-2">
        <input type="checkbox" checked={isRecurring} onChange={(e) => setIsRecurring(e.target.checked)} />
        Evento recurrente
      </label>
      {isRecurring && (
        <select
          value={recurringPattern}
          onChange={(e) => setRecurringPattern(e.target.value as RecurringPattern)}
          className="field-input md:col-span-1"
        >
          {RECURRENCES.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
      )}

      <div className="md:col-span-5">
        <ReminderCheckboxes value={reminderMinutesBefore} onChange={setReminderMinutesBefore} />
      </div>
      <div className="md:col-span-5">
        <GuestsEditor value={guests} onChange={setGuests} />
      </div>

      <button type="submit" disabled={submitting} className="btn-primary md:col-span-5 md:justify-self-start">
        {submitting ? "Guardando..." : "Añadir evento"}
      </button>
    </form>
  );
}
