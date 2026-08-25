import { useMemo, useState } from "react";
import { PageHeader } from "../components/AppShell";
import { api } from "../api/client";
import { useFetch } from "../hooks/useFetch";
import { Loading, ErrorMessage, EmptyState } from "../components/Feedback";
import { AgendaResponse, Event, EventType, Goal, RecurringPattern } from "../types";

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

function toKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function dayKeyOf(event: Event): string {
  return event.startTime.slice(0, 10);
}

export function AgendaPage() {
  const [selected, setSelected] = useState(() => toKey(new Date()));
  const [open, setOpen] = useState(false);

  const { data, loading, error, reload } = useFetch(
    () => api.get<AgendaResponse>(`/agenda/week/${selected}`),
    [selected]
  );

  const { data: goalsData } = useFetch(() => api.get<{ goals: Goal[] }>("/goals?status=active"), []);

  const week = useMemo(() => {
    if (!data?.weekStart) return [];
    const start = new Date(data.weekStart);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setUTCDate(d.getUTCDate() + i);
      return d;
    });
  }, [data?.weekStart]);

  const dayEvents = (data?.events ?? [])
    .filter((e) => dayKeyOf(e) === selected)
    .sort((a, b) => a.startTime.localeCompare(b.startTime));

  const longDate = new Date(`${selected}T00:00:00`).toLocaleDateString("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  const today = toKey(new Date());

  return (
    <>
      <PageHeader
        title="Agenda"
        subtitle={`${selected === today ? "Hoy es" : ""} ${longDate}`}
        action={
          <button onClick={() => setOpen((v) => !v)} className="btn-dark">
            {open ? "Cerrar" : "+ Nuevo evento"}
          </button>
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

      {week.length > 0 && (
        <section className="mb-12">
          <div className="grid grid-cols-7 gap-2 lg:gap-4">
            {week.map((d, i) => {
              const key = toKey(d);
              const isSelected = key === selected;
              const count = (data?.events ?? []).filter((e) => dayKeyOf(e) === key).length;
              return (
                <button
                  key={key}
                  onClick={() => setSelected(key)}
                  className={`rounded-xl border p-3 text-center transition-colors lg:p-4 ${
                    isSelected
                      ? "border-2 border-primary bg-card shadow-[var(--shadow-soft)]"
                      : "border-border bg-card/50 hover:border-primary/30"
                  }`}
                >
                  <span className={`mb-1 block text-xs font-bold ${isSelected ? "text-primary" : "text-muted-foreground"}`}>
                    {DAY_LABELS[i]}
                  </span>
                  <span className={`text-lg ${isSelected ? "font-bold" : ""}`}>{d.getUTCDate()}</span>
                  <span className="mt-2 block text-[10px] text-muted-foreground">{count > 0 ? `${count} evento${count > 1 ? "s" : ""}` : "—"}</span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      <div className="grid gap-8 lg:grid-cols-12">
        <section className="flex flex-col gap-6 lg:col-span-8">
          <h2 className="flex items-center gap-2 text-xl font-medium">
            Eventos del día
            <span className="text-sm font-normal text-muted-foreground">({dayEvents.length})</span>
          </h2>

          {loading ? (
            <Loading label="Cargando agenda..." />
          ) : dayEvents.length === 0 ? (
            <EmptyState message="No hay eventos para este día." />
          ) : (
            <div className="space-y-3">
              {dayEvents.map((event) => (
                <EventRow key={`${event.id}-${event.startTime}`} event={event} onChanged={reload} />
              ))}
            </div>
          )}
        </section>

        <section className="lg:col-span-4">
          <GoalsProgressCard goals={goalsData?.goals ?? []} />
        </section>
      </div>
    </>
  );
}

function GoalsProgressCard({ goals }: { goals: Goal[] }) {
  const percentOf = (goal: Goal) => (goal.targetValue > 0 ? Math.min(100, Math.round((goal.currentValue / goal.targetValue) * 100)) : 0);
  const overall = goals.length > 0 ? Math.round(goals.reduce((sum, g) => sum + percentOf(g), 0) / goals.length) : 0;

  return (
    <div className="rounded-3xl bg-primary p-8 text-primary-foreground">
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-xs uppercase tracking-widest opacity-60">Progreso de metas</h2>
        {goals.length > 0 && <span className="font-serif text-2xl">{overall}%</span>}
      </div>

      {goals.length === 0 ? (
        <p className="text-sm opacity-80">No tienes metas activas.</p>
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

function EventRow({ event, onChanged }: { event: Event; onChanged: () => void }) {
  const remove = async () => {
    await api.delete(`/agenda/events/${event.id}`);
    onChanged();
  };

  return (
    <div className="group flex items-center rounded-2xl border border-border bg-card p-5 transition-all hover:border-primary/30">
      <div className="flex-1">
        <p className="font-medium">{event.title}</p>
        <span className="text-xs font-semibold uppercase tracking-wider text-primary">
          {event.type}
          {event.isRecurring && " · Recurrente"}
          {event.isRecurringInstance && " (ocurrencia)"}
        </span>
      </div>
      <span className="mr-4 text-sm text-muted-foreground">
        {new Date(event.startTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} –{" "}
        {new Date(event.endTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
      </span>
      <button
        onClick={remove}
        className="cursor-pointer text-xs text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
      >
        Eliminar
      </button>
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
