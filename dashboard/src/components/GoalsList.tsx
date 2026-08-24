import { api } from "../api/client";
import { useFetch } from "../hooks/useFetch";
import { Goal } from "../types";
import { Loading, ErrorMessage, EmptyState, ProgressBar } from "./Feedback";

export function GoalsList() {
  const { data, loading, error } = useFetch(() => api.get<{ goals: Goal[] }>("/goals?status=all"), []);

  if (loading) return <Loading label="Cargando metas..." />;
  if (error) return <ErrorMessage message={error} />;
  if (!data || data.goals.length === 0) return <EmptyState message="Todavía no tienes metas creadas." />;

  return (
    <div className="card-grid">
      {data.goals.map((goal) => {
        const percent = goal.targetValue > 0 ? Math.min(100, Math.round((goal.currentValue / goal.targetValue) * 100)) : 0;
        return (
          <div key={goal.id} className="card">
            <div className="card__header">
              <h3>{goal.title}</h3>
              {goal.completed && <span className="badge badge--success">✓ Completada</span>}
            </div>
            {goal.description && <p className="card__description">{goal.description}</p>}
            <p className="card__meta">
              {goal.period === "weekly" ? "Semanal" : "Mensual"} · {goal.currentValue}/{goal.targetValue} · 🏆 {goal.bonusPoints} pts
            </p>
            <ProgressBar percent={percent} />
          </div>
        );
      })}
    </div>
  );
}
