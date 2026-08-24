import { api } from "../api/client";
import { useFetch } from "../hooks/useFetch";
import { Hobby } from "../types";
import { Loading, ErrorMessage, EmptyState } from "./Feedback";

const CATEGORY_ICONS: Record<string, string> = {
  reading: "📖",
  gaming: "🎮",
  music: "🎸",
  sports: "⚽",
  art: "🎨",
};

interface HobbyAnalytics {
  totalSessions: number;
  totalHours: number;
}

export function HobbiesList() {
  const { data, loading, error } = useFetch(() => api.get<{ hobbies: Hobby[] }>("/hobbies"), []);

  if (loading) return <Loading label="Cargando hobbies..." />;
  if (error) return <ErrorMessage message={error} />;
  if (!data || data.hobbies.length === 0) return <EmptyState message="Todavía no tienes hobbies creados." />;

  return (
    <div className="card-grid">
      {data.hobbies.map((hobby) => (
        <HobbyCard key={hobby.id} hobby={hobby} />
      ))}
    </div>
  );
}

function HobbyCard({ hobby }: { hobby: Hobby }) {
  const { data: analytics } = useFetch(() => api.get<HobbyAnalytics>(`/hobbies/${hobby.id}/analytics`), [hobby.id]);

  return (
    <div className="card">
      <div className="card__header">
        <h3>
          <span aria-hidden="true">{CATEGORY_ICONS[hobby.category] ?? "🎯"}</span> {hobby.name}
        </h3>
      </div>
      {hobby.description && <p className="card__description">{hobby.description}</p>}
      <p className="card__meta">{hobby.category}</p>
      {analytics && (
        <p className="card__meta">
          ⏱️ {analytics.totalHours}h totales · {analytics.totalSessions} sesiones
        </p>
      )}
    </div>
  );
}
