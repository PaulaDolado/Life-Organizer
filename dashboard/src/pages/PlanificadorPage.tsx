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

interface TaskFields {
  title?: string;
  description?: string | null;
}

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

  const addTask = async (status: TaskStatus, title: string, description: string) => {
    if (!title.trim()) return;
    await api.post("/planner/tasks", { title: title.trim(), description: description.trim() || undefined, status });
    reload();
  };

  // Editar título/descripción haciendo clic sobre ellos en la propia tarjeta.
  const updateTask = async (id: number, fields: TaskFields) => {
    await api.put(`/planner/tasks/${id}`, fields);
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
              onDragEnd={() => setDraggedId(null)}
              onDrop={moveTask}
              onCyclePriority={cyclePriority}
              onDelete={removeTask}
              onUpdate={updateTask}
              onAdd={(title, description) => addTask(status, title, description)}
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
  onDragEnd,
  onDrop,
  onCyclePriority,
  onDelete,
  onUpdate,
  onAdd,
}: {
  status: TaskStatus;
  label: string;
  tasks: Task[];
  draggedId: number | null;
  onDragStart: (id: number) => void;
  onDragEnd: () => void;
  onDrop: (taskId: number, status: TaskStatus, beforeTaskId: number | null) => void;
  onCyclePriority: (task: Task) => void;
  onDelete: (id: number) => void;
  onUpdate: (id: number, fields: TaskFields) => void;
  onAdd: (title: string, description: string) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
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
          <TaskCard
            key={task.id}
            task={task}
            isDragged={draggedId === task.id}
            onDragStart={(e) => {
              e.dataTransfer.setData("text/plain", String(task.id));
              onDragStart(task.id);
            }}
            onDragEnd={onDragEnd}
            onDragOver={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            onDrop={(e) => handleDrop(e, task.id)}
            onCyclePriority={() => onCyclePriority(task)}
            onDelete={() => onDelete(task.id)}
            onUpdate={(fields) => onUpdate(task.id, fields)}
          />
        ))}
      </div>

      {!adding ? (
        <button
          onClick={() => setAdding(true)}
          className="mt-3 w-full cursor-pointer rounded-xl border border-dashed border-border px-3 py-2 text-center text-xs text-muted-foreground transition-colors hover:border-primary/30 hover:text-foreground"
        >
          + Añadir tarea
        </button>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onAdd(title, description);
            setTitle("");
            setDescription("");
          }}
          className="mt-3 space-y-2"
        >
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Título de la tarea"
            className="field-input w-full text-sm"
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Descripción (opcional)"
            rows={2}
            className="field-input w-full resize-y text-sm"
          />
          <div className="flex gap-2">
            <button type="submit" className="btn-dark flex-1 text-xs">
              Añadir
            </button>
            <button
              type="button"
              onClick={() => {
                setAdding(false);
                setTitle("");
                setDescription("");
              }}
              className="cursor-pointer rounded-full border border-border px-3 text-xs text-muted-foreground transition-colors hover:bg-muted"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

function TaskCard({
  task,
  isDragged,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
  onCyclePriority,
  onDelete,
  onUpdate,
}: {
  task: Task;
  isDragged: boolean;
  onDragStart: (e: React.DragEvent) => void;
  onDragEnd: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onCyclePriority: () => void;
  onDelete: () => void;
  onUpdate: (fields: TaskFields) => void;
}) {
  const [editingField, setEditingField] = useState<"title" | "description" | null>(null);
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description ?? "");

  const saveTitle = () => {
    setEditingField(null);
    const trimmed = title.trim();
    if (!trimmed || trimmed === task.title) {
      setTitle(task.title);
      return;
    }
    onUpdate({ title: trimmed });
  };

  const saveDescription = () => {
    setEditingField(null);
    const trimmed = description.trim();
    if (trimmed === (task.description ?? "")) return;
    onUpdate({ description: trimmed || null });
  };

  return (
    <div
      // Solo arrastrable fuera de edición: si no, clicar dentro de un campo para seleccionar
      // texto se interpretaría como el inicio de un drag en vez de como editar.
      draggable={editingField === null}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
      onDrop={onDrop}
      className={`group cursor-grab rounded-xl border border-border bg-background p-3 text-left transition-opacity active:cursor-grabbing ${
        isDragged ? "opacity-40" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        {editingField === "title" ? (
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={saveTitle}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
              if (e.key === "Escape") {
                setTitle(task.title);
                setEditingField(null);
              }
            }}
            className="w-full min-w-0 border-b border-primary bg-transparent text-sm outline-none"
          />
        ) : (
          <button
            onClick={() => setEditingField("title")}
            title="Haz clic para editar"
            className="min-w-0 flex-1 cursor-text text-left text-sm decoration-dotted hover:underline"
          >
            {task.title}
          </button>
        )}
        <button
          onClick={onDelete}
          className="shrink-0 cursor-pointer text-xs text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
          aria-label="Eliminar tarea"
        >
          ✕
        </button>
      </div>

      {editingField === "description" ? (
        <textarea
          autoFocus
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          onBlur={saveDescription}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setDescription(task.description ?? "");
              setEditingField(null);
            }
          }}
          rows={2}
          className="mt-1.5 w-full resize-y border-b border-primary bg-transparent text-xs outline-none"
        />
      ) : task.description ? (
        <button
          onClick={() => setEditingField("description")}
          title="Haz clic para editar"
          className="mt-1.5 block w-full cursor-text text-left text-xs text-muted-foreground decoration-dotted hover:underline"
        >
          {task.description}
        </button>
      ) : (
        <button
          onClick={() => setEditingField("description")}
          className="mt-1.5 block cursor-text text-left text-xs italic text-muted-foreground/60 hover:underline"
        >
          + Añadir descripción
        </button>
      )}

      <button
        onClick={onCyclePriority}
        className={`mt-2 cursor-pointer rounded-full px-2 py-0.5 text-[10px] font-medium transition-opacity hover:opacity-80 ${PRIORITY_STYLES[task.priority]}`}
      >
        {PRIORITY_LABELS[task.priority]}
      </button>
    </div>
  );
}
