import { useState } from "react";
import { api } from "../api/client";
import { Habit } from "../types";

const STRIP_DAYS = 7; // un círculo por cada día de la semana

function lastDates(count: number): string[] {
  const dates: string[] = [];
  const cursor = new Date();
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(cursor);
    d.setDate(d.getDate() - i);
    dates.push(d.toISOString().slice(0, 10));
  }
  return dates;
}

/**
 * Seguimiento de hábitos diarios, junto a "Progreso de objetivos" en la Agenda: a diferencia de
 * un objetivo (un número hacia una meta con fecha de fin), un hábito no se "completa" — se marca
 * o no cada día, y lo que importa es la racha. Cada hábito muestra una tira tipo mapa de calor de
 * los últimos 14 días, clicable para marcar/desmarcar cualquiera de esos días (no solo hoy).
 */
export function HabitsTrackerCard({ habits, onChanged }: { habits: Habit[]; onChanged: () => void }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const days = lastDates(STRIP_DAYS);

  const toggleDay = async (habitId: number, date: string) => {
    await api.post(`/habits/${habitId}/toggle`, { date });
    onChanged();
  };

  const renameHabit = async (id: number, newTitle: string) => {
    await api.put(`/habits/${id}`, { title: newTitle });
    onChanged();
  };

  const removeHabit = async (id: number) => {
    await api.delete(`/habits/${id}`);
    onChanged();
  };

  return (
    <div className="rounded-3xl border border-habit/30 bg-habit/10 p-6">
      {/* Simplificado a propósito: sin texto de "vacío" — solo el título y un "+" arriba a la
          derecha que despliega el alta, igual esté vacío o ya tenga hábitos. */}
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xs font-bold uppercase tracking-widest text-habit">Hábitos diarios</h2>
        <button
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? "Cerrar" : "Añadir hábito"}
          className="flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-full bg-habit text-sm leading-none text-background transition-opacity hover:opacity-80"
        >
          {open ? "×" : "+"}
        </button>
      </div>

      {open && (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!title.trim()) return;
            setSubmitting(true);
            try {
              await api.post("/habits", { title: title.trim() });
              setTitle("");
              onChanged();
            } finally {
              setSubmitting(false);
            }
          }}
          className="mb-4"
        >
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Nombre del hábito"
            disabled={submitting}
            className="field-input w-full bg-background text-sm"
          />
        </form>
      )}

      {habits.length > 0 && (
        <ul className="flex overflow-x-auto">
          {habits.map((habit) => (
            <HabitColumn
              key={habit.id}
              habit={habit}
              days={days}
              onToggleDay={toggleDay}
              onRename={renameHabit}
              onDelete={removeHabit}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function HabitColumn({
  habit,
  days,
  onToggleDay,
  onRename,
  onDelete,
}: {
  habit: Habit;
  days: string[];
  onToggleDay: (habitId: number, date: string) => void;
  onRename: (id: number, title: string) => void;
  onDelete: (id: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(habit.title);
  const completed = new Set(habit.completedDates);

  const saveTitle = () => {
    setEditing(false);
    const trimmed = title.trim();
    if (!trimmed || trimmed === habit.title) {
      setTitle(habit.title);
      return;
    }
    onRename(habit.id, trimmed);
  };

  return (
    <li className="group min-w-[132px] flex-1 border-l border-habit/25 px-4 first:border-l-0 first:pl-0 last:pr-0">
      <div className="mb-1.5 flex items-center justify-between gap-2 text-sm">
        {editing ? (
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={saveTitle}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
              if (e.key === "Escape") {
                setTitle(habit.title);
                setEditing(false);
              }
            }}
            className="w-full min-w-0 border-b border-habit bg-transparent outline-none"
          />
        ) : (
          <button
            onClick={() => setEditing(true)}
            title="Haz clic para renombrar"
            className="min-w-0 flex-1 cursor-text truncate text-left decoration-dotted hover:underline"
          >
            {habit.title}
          </button>
        )}
        <button
          onClick={() => onDelete(habit.id)}
          className="shrink-0 cursor-pointer text-xs text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
          aria-label="Eliminar hábito"
        >
          ✕
        </button>
      </div>
      {habit.streak > 0 && <p className="mb-1.5 text-xs font-medium text-habit">{habit.streak} días</p>}
      <div className="flex gap-1">
        {days.map((date) => {
          const isCompleted = completed.has(date);
          return (
            <button
              key={date}
              onClick={() => onToggleDay(habit.id, date)}
              aria-label={`${date}${isCompleted ? " (marcado)" : ""}`}
              className={`size-3.5 shrink-0 rounded-full transition-colors ${
                isCompleted ? "bg-habit" : "bg-habit/15 hover:bg-habit/30"
              }`}
            />
          );
        })}
      </div>
    </li>
  );
}
