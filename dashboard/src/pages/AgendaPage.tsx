import { useMemo, useState } from "react";
import { PageHeader } from "../components/AppShell";
import { api } from "../api/client";
import { useFetch } from "../hooks/useFetch";
import { Loading, ErrorMessage } from "../components/Feedback";
import { AgendaResponse, Event, EventType, Goal, Note, RecurringPattern } from "../types";

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

function toKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function dayKeyOf(event: Event): string {
  return event.startTime.slice(0, 10);
}

function addDays(key: string, delta: number): string {
  const d = new Date(`${key}T00:00:00`);
  d.setDate(d.getDate() + delta);
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

export function AgendaPage() {
  const [selected, setSelected] = useState(() => toKey(new Date()));
  const [open, setOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);

  const { data, loading, error, reload } = useFetch(
    () => api.get<AgendaResponse>(`/agenda/week/${selected}`),
    [selected]
  );

  const { data: goalsData } = useFetch(() => api.get<{ goals: Goal[] }>("/goals?status=active"), []);
  const { data: notesData, reload: reloadNotes } = useFetch(() => api.get<{ notes: Note[] }>("/notes"), []);

  const week = useMemo(() => {
    if (!data?.weekStart) return [];
    const start = new Date(data.weekStart);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setUTCDate(d.getUTCDate() + i);
      return d;
    });
  }, [data?.weekStart]);

  const today = toKey(new Date());

  const weekRangeLabel = useMemo(() => {
    if (week.length === 0) return "";
    const fmt = (d: Date) => d.toLocaleDateString("es-ES", { day: "numeric", month: "short", timeZone: "UTC" });
    return `${fmt(week[0])} – ${fmt(week[6])}`;
  }, [week]);

  return (
    <>
      <PageHeader
        title="Agenda"
        subtitle={weekRangeLabel ? `Semana del ${weekRangeLabel}` : ""}
        action={
          <div className="flex items-center gap-2">
            <div className="flex items-center overflow-hidden rounded-full border border-border">
              <button
                onClick={() => setSelected((s) => addDays(s, -7))}
                className="cursor-pointer px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted"
                aria-label="Semana anterior"
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
                onClick={() => setSelected((s) => addDays(s, 7))}
                className="cursor-pointer px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted"
                aria-label="Semana siguiente"
              >
                ›
              </button>
            </div>
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

      <section className="mb-8">
        {loading ? (
          <Loading label="Cargando agenda..." />
        ) : (
          week.length > 0 && <WeekTimeGrid week={week} events={data?.events ?? []} today={today} onSelect={setEditingEvent} />
        )}
      </section>

      <section className="flex justify-end">
        <div className="w-full space-y-6 lg:max-w-sm">
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
        />
      )}
    </>
  );
}

function WeekTimeGrid({
  week,
  events,
  today,
  onSelect,
}: {
  week: Date[];
  events: Event[];
  today: string;
  onSelect: (event: Event) => void;
}) {
  return (
    <div className="overflow-x-auto rounded-3xl border border-border bg-card shadow-[var(--shadow-soft)]">
      <div className="grid min-w-[720px] grid-cols-7 divide-x divide-border">
        {week.map((d, i) => {
          const key = toKey(d);
          const isToday = key === today;
          const dayEvents = events.filter((e) => dayKeyOf(e) === key).sort((a, b) => a.startTime.localeCompare(b.startTime));

          return (
            <div key={key} className="flex flex-col">
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
                {dayEvents.map((event) => (
                  <button
                    key={`${event.id}-${event.startTime}`}
                    onClick={() => onSelect(event)}
                    className="cursor-pointer rounded-xl border border-border bg-card px-2.5 py-2 text-left transition-colors hover:border-primary/30"
                  >
                    <p className="truncate text-xs font-medium">
                      {event.title}
                      {event.isRecurring && " ↻"}
                    </p>
                    <span
                      className={`mt-1.5 inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${
                        TYPE_STYLES[event.type] ?? DEFAULT_TYPE_STYLE
                      }`}
                    >
                      {TYPE_LABELS[event.type] ?? event.type}
                    </span>
                    <p className="mt-1.5 text-[10px] text-muted-foreground">
                      {new Date(event.startTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} –{" "}
                      {new Date(event.endTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function EventDialog({
  event,
  onClose,
  onSaved,
  onDeleted,
}: {
  event: Event;
  onClose: () => void;
  onSaved: (input: NewEventInput) => Promise<void>;
  onDeleted: () => Promise<void>;
}) {
  const [title, setTitle] = useState(event.title);
  const [eventDate, setEventDate] = useState(localDateOf(event.startTime));
  const [startTime, setStartTime] = useState(localTimeOf(event.startTime));
  const [endTime, setEndTime] = useState(localTimeOf(event.endTime));
  const [type, setType] = useState<EventType>(event.type as EventType);
  const [isRecurring, setIsRecurring] = useState(event.isRecurring ?? false);
  const [recurringPattern, setRecurringPattern] = useState<RecurringPattern>(event.recurringPattern ?? "weekly");
  const [submitting, setSubmitting] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/50 p-4"
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
              startTime: new Date(`${eventDate}T${startTime}:00`).toISOString(),
              endTime: new Date(`${eventDate}T${endTime}:00`).toISOString(),
              isRecurring,
              ...(isRecurring ? { recurringPattern } : {}),
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
            Este evento pertenece a una serie recurrente. Los cambios o la eliminación afectan a toda la serie.
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
        </div>

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
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-xs uppercase tracking-widest opacity-60">Progreso de objetivos</h2>
        {goals.length > 0 && <span className="font-serif text-2xl">{overall}%</span>}
      </div>

      {goals.length === 0 ? (
        <p className="text-sm opacity-80">No tienes objetivos activos.</p>
      ) : (
        <ul className="space-y-4">
          {goals.map((goal) => {
            const percent = percentOf(goal);
            return (
              <li key={goal.id}>
                <div className="mb-1.5 flex items-center justify-between text-sm">
                  <span className="truncate pr-2 opacity-80">{goal.title}</span>
                  <span className="shrink-0 font-medium">{percent}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-primary-foreground/20">
                  <div className="h-full bg-primary-foreground transition-all" style={{ width: `${percent}%` }} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function QuickNotesCard({ notes, onChanged }: { notes: Note[]; onChanged: () => void }) {
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const toggleNote = async (note: Note) => {
    await api.put(`/notes/${note.id}`, { checked: !note.checked });
    onChanged();
  };

  const removeNote = async (id: number) => {
    await api.delete(`/notes/${id}`);
    onChanged();
  };

  return (
    <div className="rounded-3xl border border-warning/30 bg-warning/10 p-6">
      <h2 className="mb-4 text-xs font-bold uppercase tracking-widest text-warning">📌 Notas rápidas</h2>

      {notes.length === 0 ? (
        <p className="mb-4 text-sm text-muted-foreground">Sin notas todavía.</p>
      ) : (
        // Cada nota lleva una raya debajo, como el renglón de una hoja de libreta.
        <ul className="mb-4">
          {notes.map((note) => (
            <li key={note.id} className="group flex items-center gap-2.5 border-b border-warning/30 py-2.5 text-sm">
              <input
                type="checkbox"
                checked={note.checked}
                onChange={() => toggleNote(note)}
                className="size-4 shrink-0 cursor-pointer accent-warning"
                aria-label={`Marcar "${note.content}" como hecha`}
              />
              <span
                className={`flex-1 break-words ${
                  note.checked ? "text-muted-foreground line-through decoration-warning" : "text-foreground"
                }`}
              >
                {note.content}
              </span>
              <button
                onClick={() => removeNote(note.id)}
                className="cursor-pointer text-xs text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                aria-label="Eliminar nota"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}

      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (!content.trim()) return;
          setSubmitting(true);
          try {
            await api.post("/notes", { content: content.trim() });
            setContent("");
            onChanged();
          } finally {
            setSubmitting(false);
          }
        }}
      >
        <input
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="+ Añadir nota"
          disabled={submitting}
          className="field-input w-full bg-background text-sm"
        />
      </form>
    </div>
  );
}

interface NewEventInput {
  title: string;
  type: EventType;
  startTime: string;
  endTime: string;
  isRecurring: boolean;
  recurringPattern?: RecurringPattern;
}

function NewEventForm({ date, onSubmit }: { date: string; onSubmit: (input: NewEventInput) => Promise<void> }) {
  const [title, setTitle] = useState("");
  const [eventDate, setEventDate] = useState(date);
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");
  const [type, setType] = useState<EventType>("work");
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurringPattern, setRecurringPattern] = useState<RecurringPattern>("weekly");
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

      <button type="submit" disabled={submitting} className="btn-primary md:col-span-5 md:justify-self-start">
        {submitting ? "Guardando..." : "Añadir evento"}
      </button>
    </form>
  );
}
