import { useState } from "react";
import { api } from "../api/client";
import { Habit } from "../types";

const STRIP_DAYS = 7; // un punto por cada día de la semana, lunes a domingo
const DAY_LETTERS = ["L", "M", "X", "J", "V", "S", "D"];

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

// Fechas (lunes a domingo) de la semana en curso — a propósito NO es una ventana deslizante de
// "últimos 7 días" (donde hoy siempre cae en la última posición): así cada punto tiene una
// posición FIJA según el día de la semana (lunes = 1er punto ... domingo = 7º), y marcar un
// hábito desde "Hoy" siempre rellena el punto que le toca a ese día (ver toggleHabitToday en
// HoyPage, que marca la fecha de hoy — aquí solo cambia dónde se pinta esa marca).
// Al empezar una semana nueva, estas fechas cambian solas y los 7 puntos vuelven a aparecer sin
// marcar (no hay registros para las fechas nuevas todavía) — sin tocar la racha, que se calcula
// aparte a partir de TODO el historial de HabitLog (ver streak en habitsService.listHabits), así
// que no se pierde por este reinicio visual de la semana.
function currentWeekDates(): string[] {
  const today = new Date();
  const isoWeekday = (today.getDay() + 6) % 7; // 0 = lunes ... 6 = domingo (getDay() da 0 = domingo)
  const monday = new Date(today);
  monday.setDate(today.getDate() - isoWeekday);
  return Array.from({ length: STRIP_DAYS }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d.toISOString().slice(0, 10);
  });
}

/**
 * Seguimiento de hábitos diarios, junto a "Progreso de objetivos" en la Agenda: a diferencia de
 * un objetivo (un número hacia una meta con fecha de fin), un hábito no se "completa" — se marca
 * o no cada día, y lo que importa es la racha. Cada hábito muestra los 7 días de la semana en
 * curso (lunes a domingo), clicable para marcar/desmarcar cualquiera de esos días (no solo hoy).
 */
export function HabitsTrackerCard({ habits, onChanged }: { habits: Habit[]; onChanged: () => void }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const days = currentWeekDates();

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
      <div className="flex gap-1">
        {days.map((date, i) => {
          const isCompleted = completed.has(date);
          const isToday = date === todayKey();
          return (
            <div key={date} className="flex flex-col items-center gap-1">
              <span className={`text-[9px] leading-none ${isToday ? "font-bold text-habit" : "text-muted-foreground"}`}>
                {DAY_LETTERS[i]}
              </span>
              <button
                onClick={() => onToggleDay(habit.id, date)}
                title={isToday ? "Hoy" : undefined}
                aria-label={`${DAY_LETTERS[i]}${isToday ? " (hoy)" : ""}${isCompleted ? " (marcado)" : ""}`}
                // El anillo de "hoy" va hacia DENTRO (ring-inset), no hacia fuera con offset: la
                // fila vive en un <ul overflow-x-auto> (ver más abajo) y, por la propia regla de
                // CSS de overflow, eso fuerza a que el overflow vertical también se recorte — un
                // anillo con offset hacia fuera se salía unos px del círculo y se cortaba (se
                // veía como un trocito de línea en vez de un anillo completo). Hacia dentro nunca
                // sale de la caja del propio botón, así no hay nada que recortar.
                className={`size-3.5 shrink-0 rounded-full transition-colors ${
                  isCompleted ? "bg-habit" : "bg-habit/15 hover:bg-habit/30"
                } ${isToday ? "ring-2 ring-inset ring-habit" : ""}`}
              />
            </div>
          );
        })}
      </div>
    </li>
  );
}
