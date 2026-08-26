import { useState } from "react";
import { PageHeader } from "../components/AppShell";
import { api } from "../api/client";
import { useFetch } from "../hooks/useFetch";
import { Loading, ErrorMessage } from "../components/Feedback";
import { Task, TaskPriority, TaskStatus } from "../types";

const COLUMNS: { status: TaskStatus; label: string }[] = [
  { status: "todo", label: "Por hacer" },
  { status: "in_progress", label: "En progreso" },
  { status: "done", label: "Hecho" },
];

// Recuadro de cada columna: neutro para "Por hacer", amarillo para "En progreso", verde para "Hecho".
const COLUMN_STYLES: Record<TaskStatus, string> = {
  todo: "border-border bg-card",
  in_progress: "border-warning/30 bg-warning/10",
  done: "border-positive/30 bg-positive/10",
};
const COLUMN_HEADER_STYLES: Record<TaskStatus, string> = {
  todo: "text-foreground",
  in_progress: "text-warning",
  done: "text-positive",
};

const PRIORITY_ORDER: TaskPriority[] = ["low", "medium", "high"];
const PRIORITY_LABELS: Record<TaskPriority, string> = { low: "Baja", medium: "Media", high: "Alta" };
const PRIORITY_STYLES: Record<TaskPriority, string> = {
  low: "bg-muted text-muted-foreground",
  medium: "bg-warning/15 text-warning",
  high: "bg-destructive/15 text-destructive",
};

export function PlanificadorPage() {
  const { data, loading, error, reload } = useFetch(() => api.get<{ tasks: Task[] }>("/planner/tasks"), []);
  const tasks = data?.tasks ?? [];
  const [draggedId, setDraggedId] = useState<number | null>(null);

  const columnTasks = (status: TaskStatus) => tasks.filter((t) => t.status === status).sort((a, b) => a.order - b.order);

  const moveTask = async (taskId: number, targetStatus: TaskStatus, beforeTaskId: number | null) => {
    if (taskId === beforeTaskId) return;
    const inColumn = columnTasks(targetStatus).filter((t) => t.id !== taskId);
    let order: number;
    if (beforeTaskId === null) {
      const last = inColumn[inColumn.length - 1];
      order = last ? last.order + 1000 : 1000;
    } else {
      const index = inColumn.findIndex((t) => t.id === beforeTaskId);
      const before = inColumn[index];
      const prev = inColumn[index - 1];
      order = prev ? (prev.order + before.order) / 2 : before.order - 1000;
    }
    await api.put(`/planner/tasks/${taskId}`, { status: targetStatus, order });
    reload();
  };

  const cyclePriority = async (task: Task) => {
    const next = PRIORITY_ORDER[(PRIORITY_ORDER.indexOf(task.priority) + 1) % PRIORITY_ORDER.length];
    await api.put(`/planner/tasks/${task.id}`, { priority: next });
    reload();
  };

  const removeTask = async (id: number) => {
    await api.delete(`/planner/tasks/${id}`);
    reload();
  };

  const addTask = async (status: TaskStatus, title: string) => {
    if (!title.trim()) return;
    await api.post("/planner/tasks", { title: title.trim(), status });
    reload();
  };

  return (
    <>
      <PageHeader title="Planificador" subtitle="Arrastra tus tareas entre columnas" />

      {error && <ErrorMessage message={error} />}

      {loading ? (
        <Loading label="Cargando tablero..." />
      ) : (
        <div className="grid gap-6 md:grid-cols-3">
          {COLUMNS.map(({ status, label }) => (
            <KanbanColumn
              key={status}
              status={status}
              label={label}
              tasks={columnTasks(status)}
              draggedId={draggedId}
              onDragStart={setDraggedId}
              onDrop={moveTask}
              onCyclePriority={cyclePriority}
              onDelete={removeTask}
              onAdd={(title) => addTask(status, title)}
            />
          ))}
        </div>
      )}
    </>
  );
}

function KanbanColumn({
  status,
  label,
  tasks,
  draggedId,
  onDragStart,
  onDrop,
  onCyclePriority,
  onDelete,
  onAdd,
}: {
  status: TaskStatus;
  label: string;
  tasks: Task[];
  draggedId: number | null;
  onDragStart: (id: number) => void;
  onDrop: (taskId: number, status: TaskStatus, beforeTaskId: number | null) => void;
  onCyclePriority: (task: Task) => void;
  onDelete: (id: number) => void;
  onAdd: (title: string) => void;
}) {
  const [title, setTitle] = useState("");
  const [dragOver, setDragOver] = useState(false);

  const handleDrop = (e: React.DragEvent, beforeTaskId: number | null) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    const id = Number(e.dataTransfer.getData("text/plain"));
    if (!Number.isNaN(id)) onDrop(id, status, beforeTaskId);
  };

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => handleDrop(e, null)}
      className={`flex flex-col rounded-3xl border p-4 transition-colors ${
        dragOver ? "border-primary/50 bg-primary/5" : COLUMN_STYLES[status]
      }`}
    >
      <div className="mb-3 flex items-center justify-between px-1">
        <h2 className={`text-sm font-medium ${COLUMN_HEADER_STYLES[status]}`}>{label}</h2>
        <span className="text-xs text-muted-foreground">{tasks.length}</span>
      </div>

      <div className="flex min-h-16 flex-col gap-2">
        {tasks.length === 0 && !dragOver && (
          <p className="rounded-xl border border-dashed border-border px-3 py-6 text-center text-xs text-muted-foreground">
            Sin tareas
          </p>
        )}
        {tasks.map((task) => (
          <div
            key={task.id}
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData("text/plain", String(task.id));
              onDragStart(task.id);
            }}
            onDragOver={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            onDrop={(e) => handleDrop(e, task.id)}
            className={`group cursor-grab rounded-xl border border-border bg-background p-3 text-left transition-opacity active:cursor-grabbing ${
              draggedId === task.id ? "opacity-40" : ""
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm">{task.title}</p>
              <button
                onClick={() => onDelete(task.id)}
                className="cursor-pointer text-xs text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                aria-label="Eliminar tarea"
              >
                ✕
              </button>
            </div>
            <button
              onClick={() => onCyclePriority(task)}
              className={`mt-2 cursor-pointer rounded-full px-2 py-0.5 text-[10px] font-medium transition-opacity hover:opacity-80 ${PRIORITY_STYLES[task.priority]}`}
            >
              {PRIORITY_LABELS[task.priority]}
            </button>
          </div>
        ))}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          onAdd(title);
          setTitle("");
        }}
        className="mt-3"
      >
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="+ Añadir tarea"
          className="field-input w-full text-sm"
        />
      </form>
    </div>
  );
}
