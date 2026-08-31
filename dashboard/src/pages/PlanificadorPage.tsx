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

// Igual límite y mecánica que RichTextEditor.insertImage y el kanban de páginas personalizadas:
// se embebe como data URL, no hay subida a un storage aparte.
const MAX_IMAGE_BYTES = 3 * 1024 * 1024; // 3MB

interface TaskFields {
  title?: string;
  description?: string | null;
  image?: string | null;
  notes?: string | null;
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
  // de esta tarea abre directamente el diálogo de detalles y se desplaza a la vista al montar.
  focusTaskId?: number;
  onFocusHandled?: () => void;
} = {}) {
  const { data, loading, error, reload } = useFetch(() => api.get<{ tasks: Task[] }>("/planner/tasks"), []);
  const { data: projectsData } = useFetch(() => api.get<{ projects: Project[] }>("/projects?limit=100"), []);
  const tasks = data?.tasks ?? [];
  const projects = projectsData?.projects ?? [];
  const [draggedId, setDraggedId] = useState<number | null>(null);

  // Una vez la tarea buscada está en los datos cargados, ya se le ha pasado `autoFocus` a su
  // TaskCard (que abre su diálogo de detalles y captura el desplazado en su propio montaje) —
  // avisamos al padre para que limpie el foco y no se repita en cada recarga del tablero.
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

  // Editar cualquier campo de la tarea (título/descripción/imagen/notas al clicar, o los del
  // diálogo de detalles).
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
          tarjetas se desmontarían y el diálogo de detalles abierto se cerraría solo después de
          cada cambio. Solo se muestra en la carga inicial. */}
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

// La tarjeta del tablero es ahora solo una VISTA PREVIA (título, descripción corta, imagen,
// insignias) — clicar en cualquier parte que no sea una acción concreta (prioridad, eliminar)
// abre TaskDetailDialog, donde vive toda la edición de verdad (antes era un panel "Detalles" que
// se desplegaba dentro de la propia tarjeta).
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
  const [detailOpen, setDetailOpen] = useState(autoFocus ?? false);
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

  const project = projects.find((p) => p.id === task.projectId) ?? null;
  const subtasks = task.subtasks ?? [];
  const doneSubtasks = subtasks.filter((s) => s.completed).length;
  const badge = dueBadge(task);

  return (
    <>
      <div
        ref={cardRef}
        draggable
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onDragOver={onDragOver}
        onDrop={onDrop}
        onClick={() => setDetailOpen(true)}
        title="Haz clic para ver los detalles"
        className={`group cursor-grab rounded-xl border border-border bg-background p-3 text-left transition-all active:cursor-grabbing ${
          isDragged ? "opacity-40" : ""
        } ${justFocused ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : ""}`}
      >
        {task.image && <img src={task.image} alt="" className="mb-2 max-h-32 w-full rounded-lg object-cover" />}

        <div className="flex items-start justify-between gap-2">
          <span className={`min-w-0 flex-1 text-sm ${task.status === "done" ? "text-muted-foreground line-through" : ""}`}>
            {task.title}
          </span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="shrink-0 cursor-pointer text-xs text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
            aria-label="Eliminar tarea"
          >
            ✕
          </button>
        </div>

        {task.description && <p className="mt-1.5 truncate text-xs text-muted-foreground">{task.description}</p>}

        {/* Insignias compactas */}
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onCyclePriority();
            }}
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
          {task.notes && <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">📝</span>}
          {task.tags.map((tag) => (
            <span key={tag} className="rounded-full border border-border px-2 py-0.5 text-[10px] text-muted-foreground">
              #{tag}
            </span>
          ))}
        </div>
      </div>

      {detailOpen && (
        <TaskDetailDialog
          task={task}
          projects={projects}
          onClose={() => setDetailOpen(false)}
          onUpdate={onUpdate}
          onDelete={() => {
            onDelete();
            setDetailOpen(false);
          }}
          onLogTime={onLogTime}
          onAddSubtask={onAddSubtask}
          onToggleSubtask={onToggleSubtask}
          onRemoveSubtask={onRemoveSubtask}
        />
      )}
    </>
  );
}

/**
 * Diálogo de detalles de una tarea — se abre al clicar la tarjeta. Reúne todo lo que antes vivía
 * en el panel "Detalles" desplegable de la tarjeta (subtareas, fecha límite, proyecto, etiquetas,
 * tiempo), más lo nuevo: imagen y un recuadro grande DE TEXTO LIBRE SIN NOMBRE ni etiqueta —a
 * propósito, para que sea justo "todo lo que el usuario quiera apuntar" aparte de la descripción
 * corta, sin que un título lo condicione a un tipo de contenido concreto.
 */
function TaskDetailDialog({
  task,
  projects,
  onClose,
  onUpdate,
  onDelete,
  onLogTime,
  onAddSubtask,
  onToggleSubtask,
  onRemoveSubtask,
}: {
  task: Task;
  projects: Project[];
  onClose: () => void;
  onUpdate: (fields: TaskFields) => void;
  onDelete: () => void;
  onLogTime: (minutes: number) => void;
  onAddSubtask: (title: string) => void;
  onToggleSubtask: (subtask: Subtask) => void;
  onRemoveSubtask: (subtaskId: number) => void;
}) {
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description ?? "");
  const [notes, setNotes] = useState(task.notes ?? "");
  const [newSubtask, setNewSubtask] = useState("");
  const [newTag, setNewTag] = useState("");
  const [minutesToLog, setMinutesToLog] = useState("");
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // El textarea de notas es redimensionable en ambas direcciones (ver className más abajo), tanto
  // para agrandarlo como para encogerlo. En vez de dejar que crezca solapándose con la columna
  // derecha (fecha, proyecto, etiquetas...) o que el diálogo se quede con un hueco de sobra al
  // encogerlo, el propio diálogo sigue al textarea en ambos sentidos — la columna derecha
  // mantiene siempre su ancho de siempre, solo cambia la izquierda (y el diálogo entero con ella).
  const modalRef = useRef<HTMLDivElement>(null);
  const notesRef = useRef<HTMLTextAreaElement>(null);
  const naturalSizeRef = useRef<{ modalWidth: number; leftWidth: number } | null>(null);
  const [customSize, setCustomSize] = useState<{ modalWidth: number; leftWidth: number } | null>(null);

  useEffect(() => {
    const notesEl = notesRef.current;
    if (!notesEl) return;
    const observer = new ResizeObserver(() => {
      // Solo tiene sentido en dos columnas (desde `md`) — en móvil todo va apilado a lo ancho
      // de la pantalla y no hay nada con lo que "chocar".
      if (!window.matchMedia("(min-width: 768px)").matches || !modalRef.current) return;
      // La primera medida (antes de que el usuario toque el tirador) es la referencia "de
      // fábrica" con la que comparar cuánto se ha movido, en cualquiera de los dos sentidos.
      if (!naturalSizeRef.current) {
        naturalSizeRef.current = { modalWidth: modalRef.current.getBoundingClientRect().width, leftWidth: notesEl.getBoundingClientRect().width };
        return;
      }
      const { modalWidth, leftWidth } = naturalSizeRef.current;
      const delta = notesEl.getBoundingClientRect().width - leftWidth;
      if (Math.abs(delta) <= 2) {
        setCustomSize(null);
        return;
      }
      // Al agrandar, tope en el 95% del ancho de la ventana; al encoger, el propio `min-w-*`
      // del textarea ya pone el límite (el navegador no deja arrastrar más allá), así que no
      // hace falta otro tope aquí.
      const maxModalWidth = window.innerWidth * 0.95;
      const clampedDelta = delta > 0 ? Math.min(delta, Math.max(maxModalWidth - modalWidth, 0)) : delta;
      setCustomSize({ modalWidth: modalWidth + clampedDelta, leftWidth: leftWidth + clampedDelta });
    });
    observer.observe(notesEl);
    return () => observer.disconnect();
  }, []);

  const subtasks = task.subtasks ?? [];

  const saveTitle = () => {
    const trimmed = title.trim();
    if (!trimmed || trimmed === task.title) {
      setTitle(task.title);
      return;
    }
    onUpdate({ title: trimmed });
  };

  const saveDescription = () => {
    const trimmed = description.trim();
    if (trimmed === (task.description ?? "")) return;
    onUpdate({ description: trimmed || null });
  };

  const saveNotes = () => {
    if (notes === (task.notes ?? "")) return;
    onUpdate({ notes: notes || null });
  };

  const handleImageFile = (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) return;
    if (file.size > MAX_IMAGE_BYTES) {
      window.alert("La imagen es demasiado grande (máx. 3 MB).");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => onUpdate({ image: reader.result as string });
    reader.readAsDataURL(file);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-foreground/50 p-4"
      onClick={onClose}
    >
      <div
        ref={modalRef}
        onClick={(e) => e.stopPropagation()}
        style={customSize ? { width: `${customSize.modalWidth}px`, maxWidth: "95vw" } : undefined}
        className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-3xl bg-card p-6 shadow-[var(--shadow-soft)] sm:p-8"
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={saveTitle}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            }}
            className="min-w-0 flex-1 border-b border-transparent bg-transparent font-serif text-2xl outline-none focus:border-primary"
          />
          <button type="button" onClick={onClose} className="shrink-0 cursor-pointer text-xs text-muted-foreground hover:text-foreground">
            ✕ Cerrar
          </button>
        </div>

        {/* Dos columnas desde md: a la izquierda lo "de escribir" (imagen, descripción, notas
            libres); a la derecha lo "de organizar" (subtareas, fecha, proyecto, etiquetas,
            tiempo). En pantallas estrechas se apilan en una sola columna. */}
        <div
          className="grid grid-cols-1 gap-6 md:grid-cols-2"
          style={customSize ? { gridTemplateColumns: `${customSize.leftWidth}px minmax(0, 1fr)` } : undefined}
        >
          <div>
            {task.image && <img src={task.image} alt="" className="mb-3 max-h-56 w-full rounded-xl object-cover" />}
            <div className="mb-4 flex items-center gap-3 text-xs">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="cursor-pointer text-muted-foreground hover:text-foreground"
              >
                {task.image ? "🖼 Cambiar imagen" : "🖼 Añadir imagen"}
              </button>
              {task.image && (
                <button
                  type="button"
                  onClick={() => onUpdate({ image: null })}
                  className="cursor-pointer text-muted-foreground hover:text-destructive"
                >
                  Quitar imagen
                </button>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  handleImageFile(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
            </div>

            <label className="mb-4 flex flex-col gap-1 text-xs font-bold uppercase tracking-widest text-muted-foreground">
              Descripción
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                onBlur={saveDescription}
                rows={2}
                placeholder="Resumen corto (opcional)"
                className="field-input w-full resize-y text-sm normal-case tracking-normal"
              />
            </label>

            {/* Recuadro grande SIN nombre — todo lo demás que el usuario quiera escribir.
                `w-full` es solo el ancho DE PARTIDA (ocupa toda la columna antes de tocar nada);
                `resize` (no solo `resize-y`) deja tirar tanto del ancho como del alto, para
                agrandarlo o para encogerlo — al arrastrar, el navegador fija un ancho en línea
                que manda por encima de `w-full`, así que puede bajar de eso hasta el suelo de
                `min-w-[12rem]` (para que no quede inservible) o subir todo lo que haga falta. El
                `ResizeObserver` de arriba sigue ese ancho en ambos sentidos y ajusta el diálogo
                entero para que nunca se solape con la columna de la derecha ni se quede con un
                hueco de sobra. */}
            <textarea
              ref={notesRef}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onBlur={saveNotes}
              rows={10}
              placeholder="Escribe aquí…"
              className="field-input w-full min-w-[12rem] resize text-sm"
            />
          </div>

          <div className="space-y-4 border-t border-border pt-4 md:border-l md:border-t-0 md:pl-6 md:pt-0">
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
                <button
                  type="submit"
                  className="shrink-0 cursor-pointer rounded-full border border-border px-2 text-xs text-muted-foreground hover:bg-muted"
                >
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
        </div>

        <div className="mt-6 flex justify-end border-t border-border pt-4">
          <button
            onClick={() => {
              if (!confirmingDelete) {
                setConfirmingDelete(true);
                return;
              }
              onDelete();
            }}
            onBlur={() => setConfirmingDelete(false)}
            className={`cursor-pointer whitespace-nowrap rounded-full px-4 py-1.5 text-xs transition-colors ${
              confirmingDelete
                ? "bg-destructive text-destructive-foreground"
                : "border border-border text-muted-foreground hover:text-destructive"
            }`}
          >
            {confirmingDelete ? "¿Confirmar eliminar?" : "Eliminar tarea"}
          </button>
        </div>
      </div>
    </div>
  );
}
