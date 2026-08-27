import { useEffect, useRef, useState } from "react";
import { PageHeader } from "../components/AppShell";
import { api } from "../api/client";
import { useFetch } from "../hooks/useFetch";
import { Loading, ErrorMessage } from "../components/Feedback";
import { Task, TaskPriority, TaskStatus, Subtask, Project } from "../types";

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
  dueDate?: string | null;
  tags?: string[];
  estimatedMinutes?: number | null;
  projectId?: number | null;
}

function toDateInputValue(iso: string | null): string {
  return iso ? iso.slice(0, 10) : "";
}

function dueBadge(task: Task): { label: string; className: string } | null {
  if (!task.dueDate) return null;
  const due = new Date(task.dueDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.round((due.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
  const label = due.toLocaleDateString("es-ES", { day: "2-digit", month: "short" });

  if (task.status === "done") return { label, className: "bg-muted text-muted-foreground" };
  if (diffDays < 0) return { label: `Venció ${label}`, className: "bg-destructive/15 text-destructive" };
  if (diffDays === 0) return { label: "Hoy", className: "bg-destructive/15 text-destructive" };
  if (diffDays <= 2) return { label, className: "bg-warning/15 text-warning" };
  return { label, className: "bg-muted text-muted-foreground" };
}

export function PlanificadorPage({
  focusTaskId,
  onFocusHandled,
}: {
  // Llegada desde un resultado de la búsqueda global (ver AppShell.GlobalSearch): la tarjeta
  // de esta tarea se abre expandida y se desplaza a la vista al montar.
  focusTaskId?: number;
  onFocusHandled?: () => void;
} = {}) {
  const { data, loading, error, reload } = useFetch(() => api.get<{ tasks: Task[] }>("/planner/tasks"), []);
  const { data: projectsData } = useFetch(() => api.get<{ projects: Project[] }>("/projects?limit=100"), []);
  const tasks = data?.tasks ?? [];
  const projects = projectsData?.projects ?? [];
  const [draggedId, setDraggedId] = useState<number | null>(null);

  // Una vez la tarea buscada está en los datos cargados, ya se le ha pasado `autoFocus` a su
  // TaskCard (que captura el desplegado/scroll en su propio montaje) — avisamos al padre para
  // que limpie el foco y no se repita en cada recarga del tablero.
  useEffect(() => {
    if (focusTaskId && onFocusHandled && tasks.some((t) => t.id === focusTaskId)) {
      onFocusHandled();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusTaskId, tasks]);

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

  // Editar cualquier campo de la tarea (título/descripción al clicar, o los del panel de detalles).
  const updateTask = async (id: number, fields: TaskFields) => {
    await api.put(`/planner/tasks/${id}`, fields);
    reload();
  };

  const logTime = async (id: number, minutes: number) => {
    if (!minutes || minutes <= 0) return;
    await api.post(`/planner/tasks/${id}/time`, { minutes });
    reload();
  };

  const addSubtask = async (taskId: number, title: string) => {
    if (!title.trim()) return;
    await api.post(`/planner/tasks/${taskId}/subtasks`, { title: title.trim() });
    reload();
  };

  const toggleSubtask = async (taskId: number, subtask: Subtask) => {
    await api.put(`/planner/tasks/${taskId}/subtasks/${subtask.id}`, { completed: !subtask.completed });
    reload();
  };

  const removeSubtask = async (taskId: number, subtaskId: number) => {
    await api.delete(`/planner/tasks/${taskId}/subtasks/${subtaskId}`);
    reload();
  };

  return (
    <>
      <PageHeader title="Planificador" subtitle="Arrastra tus tareas entre columnas" />

      {error && <ErrorMessage message={error} />}

      {/* `loading && !data`, no solo `loading`: cada acción (subtarea, fecha límite, tiempo...)
          recarga el tablero, y si se sustituyera todo por el spinner en cada recarga, las
          tarjetas se desmontarían y perderían su estado local (p. ej. el panel de "Detalles"
          expandido se cerraría solo después de cada cambio). Solo se muestra en la carga inicial. */}
      {loading && !data ? (
        <Loading label="Cargando tablero..." />
      ) : (
        <div className="grid gap-6 md:grid-cols-3">
          {COLUMNS.map(({ status, label }) => (
            <KanbanColumn
              key={status}
              status={status}
              label={label}
              tasks={columnTasks(status)}
              projects={projects}
              focusTaskId={focusTaskId}
              draggedId={draggedId}
              onDragStart={setDraggedId}
              onDragEnd={() => setDraggedId(null)}
              onDrop={moveTask}
              onCyclePriority={cyclePriority}
              onDelete={removeTask}
              onUpdate={updateTask}
              onLogTime={logTime}
              onAddSubtask={addSubtask}
              onToggleSubtask={toggleSubtask}
              onRemoveSubtask={removeSubtask}
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
  projects,
  focusTaskId,
  draggedId,
  onDragStart,
  onDragEnd,
  onDrop,
  onCyclePriority,
  onDelete,
  onUpdate,
  onLogTime,
  onAddSubtask,
  onToggleSubtask,
  onRemoveSubtask,
  onAdd,
}: {
  status: TaskStatus;
  label: string;
  tasks: Task[];
  projects: Project[];
  focusTaskId?: number;
  draggedId: number | null;
  onDragStart: (id: number) => void;
  onDragEnd: () => void;
  onDrop: (taskId: number, status: TaskStatus, beforeTaskId: number | null) => void;
  onCyclePriority: (task: Task) => void;
  onDelete: (id: number) => void;
  onUpdate: (id: number, fields: TaskFields) => void;
  onLogTime: (id: number, minutes: number) => void;
  onAddSubtask: (taskId: number, title: string) => void;
  onToggleSubtask: (taskId: number, subtask: Subtask) => void;
  onRemoveSubtask: (taskId: number, subtaskId: number) => void;
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
            projects={projects}
            autoFocus={task.id === focusTaskId}
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
            onLogTime={(minutes) => onLogTime(task.id, minutes)}
            onAddSubtask={(subtaskTitle) => onAddSubtask(task.id, subtaskTitle)}
            onToggleSubtask={(subtask) => onToggleSubtask(task.id, subtask)}
            onRemoveSubtask={(subtaskId) => onRemoveSubtask(task.id, subtaskId)}
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
  projects,
  autoFocus,
  isDragged,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
  onCyclePriority,
  onDelete,
  onUpdate,
  onLogTime,
  onAddSubtask,
  onToggleSubtask,
  onRemoveSubtask,
}: {
  task: Task;
  projects: Project[];
  autoFocus?: boolean;
  isDragged: boolean;
  onDragStart: (e: React.DragEvent) => void;
  onDragEnd: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onCyclePriority: () => void;
  onDelete: () => void;
  onUpdate: (fields: TaskFields) => void;
  onLogTime: (minutes: number) => void;
  onAddSubtask: (title: string) => void;
  onToggleSubtask: (subtask: Subtask) => void;
  onRemoveSubtask: (subtaskId: number) => void;
}) {
  const [editingField, setEditingField] = useState<"title" | "description" | null>(null);
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description ?? "");
  // Si llega desde la búsqueda global, arranca ya expandida.
  const [expanded, setExpanded] = useState(autoFocus ?? false);
  const [newSubtask, setNewSubtask] = useState("");
  const [newTag, setNewTag] = useState("");
  const [minutesToLog, setMinutesToLog] = useState("");
  const [justFocused, setJustFocused] = useState(autoFocus ?? false);
  const cardRef = useRef<HTMLDivElement>(null);

  // Solo al montar: si viene de la búsqueda global, la desplaza a la vista y le quita el
  // resalte tras un momento — no depende de `autoFocus` en el array de deps a propósito
  // (es un prop que solo tiene sentido en el primer render de esta tarjeta en concreto).
  useEffect(() => {
    if (!autoFocus) return;
    cardRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    const timer = setTimeout(() => setJustFocused(false), 2000);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  const project = projects.find((p) => p.id === task.projectId) ?? null;
  const subtasks = task.subtasks ?? [];
  const doneSubtasks = subtasks.filter((s) => s.completed).length;
  const badge = dueBadge(task);

  return (
    <div
      ref={cardRef}
      // Solo arrastrable fuera de edición: si no, clicar dentro de un campo para seleccionar
      // texto o abrir el panel de detalles se interpretaría como el inicio de un drag.
      draggable={editingField === null && !expanded}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
      onDrop={onDrop}
      className={`group rounded-xl border border-border bg-background p-3 text-left transition-all ${
        expanded ? "" : "cursor-grab active:cursor-grabbing"
      } ${isDragged ? "opacity-40" : ""} ${justFocused ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : ""}`}
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
            className={`min-w-0 flex-1 cursor-text text-left text-sm decoration-dotted hover:underline ${
              task.status === "done" ? "text-muted-foreground line-through" : ""
            }`}
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

      {/* Insignias compactas: siempre visibles aunque el panel de detalles esté cerrado */}
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <button
          onClick={onCyclePriority}
          className={`cursor-pointer rounded-full px-2 py-0.5 text-[10px] font-medium transition-opacity hover:opacity-80 ${PRIORITY_STYLES[task.priority]}`}
        >
          {PRIORITY_LABELS[task.priority]}
        </button>
        {badge && <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${badge.className}`}>📅 {badge.label}</span>}
        {project && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">📁 {project.title}</span>}
        {subtasks.length > 0 && (
          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
            ☑ {doneSubtasks}/{subtasks.length}
          </span>
        )}
        {(task.estimatedMinutes || task.actualMinutes > 0) && (
          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
            ⏱ {task.actualMinutes}
            {task.estimatedMinutes ? `/${task.estimatedMinutes}` : ""} min
          </span>
        )}
        {task.tags.map((tag) => (
          <span key={tag} className="rounded-full border border-border px-2 py-0.5 text-[10px] text-muted-foreground">
            #{tag}
          </span>
        ))}
        <button
          onClick={() => setExpanded((v) => !v)}
          className="ml-auto cursor-pointer text-[10px] text-muted-foreground underline decoration-dotted hover:text-foreground"
        >
          {expanded ? "Ocultar detalles" : "Detalles"}
        </button>
      </div>

      {expanded && (
        <div className="mt-3 space-y-3 border-t border-border pt-3">
          {/* Subtareas */}
          <div>
            <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Subtareas</p>
            <ul className="space-y-1">
              {subtasks.map((s) => (
                <li key={s.id} className="group/sub flex items-center gap-2">
                  <button
                    onClick={() => onToggleSubtask(s)}
                    className={`flex size-4 shrink-0 cursor-pointer items-center justify-center rounded-sm border text-[9px] ${
                      s.completed ? "border-primary bg-primary/20 text-primary" : "border-foreground/30"
                    }`}
                  >
                    {s.completed ? "✓" : ""}
                  </button>
                  <span className={`flex-1 text-xs ${s.completed ? "text-muted-foreground line-through" : ""}`}>{s.title}</span>
                  <button
                    onClick={() => onRemoveSubtask(s.id)}
                    className="cursor-pointer text-[10px] text-muted-foreground opacity-0 hover:text-destructive group-hover/sub:opacity-100"
                    aria-label="Eliminar subtarea"
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                onAddSubtask(newSubtask);
                setNewSubtask("");
              }}
              className="mt-1.5 flex gap-1.5"
            >
              <input
                value={newSubtask}
                onChange={(e) => setNewSubtask(e.target.value)}
                placeholder="+ Paso"
                className="field-input w-full text-xs"
              />
              <button type="submit" className="shrink-0 cursor-pointer rounded-full border border-border px-2 text-xs text-muted-foreground hover:bg-muted">
                OK
              </button>
            </form>
          </div>

          {/* Fecha límite */}
          <div>
            <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Fecha límite</p>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={toDateInputValue(task.dueDate)}
                onChange={(e) => onUpdate({ dueDate: e.target.value ? new Date(e.target.value).toISOString() : null })}
                className="field-input text-xs"
              />
              {task.dueDate && (
                <button onClick={() => onUpdate({ dueDate: null })} className="cursor-pointer text-xs text-muted-foreground hover:text-destructive">
                  Quitar
                </button>
              )}
            </div>
          </div>

          {/* Proyecto */}
          <div>
            <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Proyecto</p>
            <select
              value={task.projectId ?? ""}
              onChange={(e) => onUpdate({ projectId: e.target.value ? Number(e.target.value) : null })}
              className="field-input w-full text-xs"
            >
              <option value="">Sin proyecto</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>
          </div>

          {/* Etiquetas */}
          <div>
            <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Etiquetas</p>
            <div className="flex flex-wrap items-center gap-1.5">
              {task.tags.map((tag) => (
                <span key={tag} className="flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-[10px] text-muted-foreground">
                  #{tag}
                  <button
                    onClick={() => onUpdate({ tags: task.tags.filter((t) => t !== tag) })}
                    className="cursor-pointer hover:text-destructive"
                    aria-label={`Quitar etiqueta ${tag}`}
                  >
                    ✕
                  </button>
                </span>
              ))}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const trimmed = newTag.trim().toLowerCase();
                  if (!trimmed || task.tags.includes(trimmed)) return;
                  onUpdate({ tags: [...task.tags, trimmed] });
                  setNewTag("");
                }}
                className="flex gap-1"
              >
                <input
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  placeholder="+ etiqueta"
                  className="field-input w-24 text-xs"
                />
                <button type="submit" className="cursor-pointer rounded-full border border-border px-2 text-xs text-muted-foreground hover:bg-muted">
                  OK
                </button>
              </form>
            </div>
          </div>

          {/* Tiempo estimado vs. real */}
          <div>
            <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Tiempo (minutos)</p>
            <div className="flex flex-wrap items-center gap-2">
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                Estimado
                <input
                  type="number"
                  min={1}
                  defaultValue={task.estimatedMinutes ?? ""}
                  onBlur={(e) => {
                    const value = e.target.value ? Number(e.target.value) : null;
                    if (value !== task.estimatedMinutes) onUpdate({ estimatedMinutes: value });
                  }}
                  className="field-input w-16 text-xs"
                />
              </label>
              <span className="text-xs text-muted-foreground">Real: {task.actualMinutes}</span>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  onLogTime(Number(minutesToLog));
                  setMinutesToLog("");
                }}
                className="flex items-center gap-1.5"
              >
                <input
                  type="number"
                  min={1}
                  value={minutesToLog}
                  onChange={(e) => setMinutesToLog(e.target.value)}
                  placeholder="+min"
                  className="field-input w-16 text-xs"
                />
                <button type="submit" className="cursor-pointer rounded-full border border-border px-2 text-xs text-muted-foreground hover:bg-muted">
                  Registrar
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
