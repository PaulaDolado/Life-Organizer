import { FormEvent, useState } from "react";
import { PageHeader } from "../components/AppShell";
import { api } from "../api/client";
import { useFetch } from "../hooks/useFetch";
import { Loading, ErrorMessage, EmptyState } from "../components/Feedback";
import { Goal, GoalStatus, Pagination } from "../types";

const STATUS_TABS: { value: GoalStatus; label: string }[] = [
  { value: "active", label: "Activas" },
  { value: "completed", label: "Completadas" },
  { value: "expired", label: "Vencidas" },
  { value: "all", label: "Todas" },
];

export function MetasPage() {
  const [status, setStatus] = useState<GoalStatus>("active");
  const [open, setOpen] = useState(false);

  const { data, loading, error, reload } = useFetch(
    () => api.get<{ goals: Goal[]; pagination: Pagination }>(`/goals?status=${status}`),
    [status]
  );

  return (
    <>
      <PageHeader
        title="Metas"
        subtitle="Objetivos semanales y mensuales, con racha y bonificación"
        action={
          <button onClick={() => setOpen((v) => !v)} className="btn-dark">
            {open ? "Cerrar" : "+ Nueva meta"}
          </button>
        }
      />

      {open && (
        <NewGoalForm
          onSubmit={async (input) => {
            await api.post("/goals", input);
            setOpen(false);
            reload();
          }}
        />
      )}

      <div className="mb-8 flex gap-2 overflow-x-auto">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setStatus(tab.value)}
            className={`whitespace-nowrap rounded-full px-4 py-2 text-sm transition-colors ${
              status === tab.value ? "bg-primary text-primary-foreground" : "border border-border text-muted-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {error && <ErrorMessage message={error} />}
      {loading ? (
        <Loading label="Cargando metas..." />
      ) : (data?.goals.length ?? 0) === 0 ? (
        <EmptyState message="No hay metas en esta categoría." />
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          {data?.goals.map((goal) => <GoalCard key={goal.id} goal={goal} onChanged={reload} />)}
        </div>
      )}
    </>
  );
}

function GoalCard({ goal, onChanged }: { goal: Goal; onChanged: () => void }) {
  const [value, setValue] = useState("1");
  const percent = goal.targetValue > 0 ? Math.min(100, Math.round((goal.currentValue / goal.targetValue) * 100)) : 0;

  const registerProgress = async (e: FormEvent) => {
    e.preventDefault();
    const n = Number(value);
    if (!n) return;
    await api.post(`/goals/${goal.id}/progress`, { value: n });
    onChanged();
  };

  const remove = async () => {
    await api.delete(`/goals/${goal.id}`);
    onChanged();
  };

  return (
    <article className="card-soft flex flex-col gap-4">
      <div className="flex items-start justify-between gap-4">
        <h2 className="font-serif text-2xl">{goal.title}</h2>
        <div className="flex flex-col items-end gap-1">
          {goal.completed && <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">✓ Completada</span>}
          {goal.expired && !goal.completed && (
            <span className="rounded-full bg-destructive/10 px-3 py-1 text-xs font-bold text-destructive">Vencida</span>
          )}
        </div>
      </div>
      {goal.description && <p className="text-sm text-muted-foreground">{goal.description}</p>}
      <p className="text-sm text-muted-foreground">
        {goal.period === "weekly" ? "Semanal" : "Mensual"} · {goal.currentValue}/{goal.targetValue} · 🏆 {goal.bonusPoints} pts
        {goal.autoRenew && " · se renueva sola"}
      </p>

      <div className="h-3 overflow-hidden rounded-full bg-muted">
        <div className="h-full bg-primary transition-all" style={{ width: `${percent}%` }} />
      </div>

      {!goal.completed && !goal.expired && (
        <form onSubmit={registerProgress} className="flex items-center gap-2">
          <input
            type="number"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="field-input w-24"
          />
          <button type="submit" className="btn-primary px-4 py-2 text-xs">
            Registrar progreso
          </button>
        </form>
      )}

      <button onClick={remove} className="cursor-pointer self-end text-xs text-muted-foreground hover:text-destructive">
        Eliminar
      </button>
    </article>
  );
}

interface NewGoalInput {
  title: string;
  period: "weekly" | "monthly";
  targetValue: number;
  autoRenew: boolean;
}

function NewGoalForm({ onSubmit }: { onSubmit: (input: NewGoalInput) => Promise<void> }) {
  const [title, setTitle] = useState("");
  const [period, setPeriod] = useState<"weekly" | "monthly">("weekly");
  const [targetValue, setTargetValue] = useState("5");
  const [autoRenew, setAutoRenew] = useState(true);

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        if (!title.trim()) return;
        await onSubmit({ title: title.trim(), period, targetValue: Number(targetValue) || 1, autoRenew });
        setTitle("");
      }}
      className="mb-10 grid gap-4 card-soft md:grid-cols-[2fr_1fr_1fr_auto]"
    >
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ej. Ejercicio 5 días" className="field-input" />
      <select value={period} onChange={(e) => setPeriod(e.target.value as "weekly" | "monthly")} className="field-input">
        <option value="weekly">Semanal</option>
        <option value="monthly">Mensual</option>
      </select>
      <input type="number" min="1" value={targetValue} onChange={(e) => setTargetValue(e.target.value)} className="field-input" />
      <label className="flex items-center gap-2 whitespace-nowrap text-sm text-muted-foreground">
        <input type="checkbox" checked={autoRenew} onChange={(e) => setAutoRenew(e.target.checked)} />
        Renovar sola
      </label>
      <button type="submit" className="btn-primary md:col-span-4 md:justify-self-start">
        Crear meta
      </button>
    </form>
  );
}
