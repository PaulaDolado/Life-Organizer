import { useMemo } from "react";
import { api } from "../api/client";
import { useFetch } from "../hooks/useFetch";
import { AgendaWeekResponse } from "../types";
import { Loading, ErrorMessage, EmptyState } from "./Feedback";

const DAY_LABELS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

const TYPE_COLORS: Record<string, string> = {
  work: "#4f6bed",
  study: "#7c3aed",
  gym: "#16a34a",
  meeting: "#ea580c",
  free: "#64748b",
};

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function AgendaWeekView() {
  const { data, loading, error, reload } = useFetch(
    () => api.get<AgendaWeekResponse>(`/agenda/week/${todayIso()}`),
    []
  );

  const eventsByDay = useMemo(() => {
    const buckets: Record<number, AgendaWeekResponse["events"]> = {};
    for (let i = 0; i < 7; i += 1) buckets[i] = [];
    data?.events.forEach((event) => {
      const day = (new Date(event.startTime).getDay() + 6) % 7; // lunes=0 ... domingo=6
      buckets[day] = [...(buckets[day] ?? []), event];
    });
    return buckets;
  }, [data]);

  if (loading) return <Loading label="Cargando agenda..." />;
  if (error) return <ErrorMessage message={error} />;
  if (!data || data.events.length === 0) {
    return (
      <div>
        <EmptyState message="No tienes eventos esta semana." />
        <button className="button button--ghost" onClick={reload}>
          Recargar
        </button>
      </div>
    );
  }

  return (
    <div>
      <h2>Semana del {data.week}</h2>
      <div className="agenda-grid">
        {DAY_LABELS.map((label, i) => (
          <div key={label} className="agenda-day">
            <h3>{label}</h3>
            {eventsByDay[i].length === 0 ? (
              <p className="agenda-day__empty">—</p>
            ) : (
              eventsByDay[i].map((event) => (
                <div key={event.id} className="agenda-event" style={{ borderLeftColor: TYPE_COLORS[event.type] ?? "#94a3b8" }}>
                  <strong>{event.title}</strong>
                  <span>
                    {new Date(event.startTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} –{" "}
                    {new Date(event.endTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                  <span className="agenda-event__type">{event.type}</span>
                </div>
              ))
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
