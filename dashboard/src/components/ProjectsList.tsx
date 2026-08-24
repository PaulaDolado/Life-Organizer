import { api } from "../api/client";
import { useFetch } from "../hooks/useFetch";
import { Project } from "../types";
import { Loading, ErrorMessage, EmptyState, ProgressBar } from "./Feedback";

const STATUS_LABELS: Record<string, string> = {
  idea: "Idea",
  en_curso: "En curso",
  pausado: "Pausado",
  completado: "Completado",
};

const PRIORITY_LABELS: Record<string, string> = {
  low: "Baja",
  medium: "Media",
  high: "Alta",
};

export function ProjectsList() {
  const { data, loading, error } = useFetch(() => api.get<{ projects: Project[] }>("/projects"), []);

  if (loading) return <Loading label="Cargando proyectos..." />;
  if (error) return <ErrorMessage message={error} />;
  if (!data || data.projects.length === 0) return <EmptyState message="Todavía no tienes proyectos creados." />;

  return (
    <div className="card-grid">
      {data.projects.map((project) => (
        <ProjectCard key={project.id} projectId={project.id} summary={project} />
      ))}
    </div>
  );
}

function ProjectCard({ projectId, summary }: { projectId: number; summary: Project }) {
  const { data: detail } = useFetch(() => api.get<Project>(`/projects/${projectId}`), [projectId]);
  const progress = detail?.progress ?? { total: 0, completed: 0, percent: 0 };

  return (
    <div className="card">
      <div className="card__header">
        <h3>{summary.title}</h3>
        <span className={`badge badge--priority-${summary.priority}`}>{PRIORITY_LABELS[summary.priority]}</span>
      </div>
      {summary.description && <p className="card__description">{summary.description}</p>}
      <p className="card__meta">
        {STATUS_LABELS[summary.status] ?? summary.status}
        {summary.deadline && ` · vence ${new Date(summary.deadline).toLocaleDateString()}`}
      </p>
      <ProgressBar percent={progress.percent} />
      <p className="card__meta">
        {progress.completed}/{progress.total} tareas completadas
      </p>
    </div>
  );
}
