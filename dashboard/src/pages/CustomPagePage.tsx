import { FormEvent, useEffect, useRef, useState } from "react";
import { api } from "../api/client";
import { useFetch } from "../hooks/useFetch";
import { Loading, ErrorMessage, EmptyState } from "../components/Feedback";
import { RichTextEditor } from "../components/RichTextEditor";
import { newId } from "../utils/id";
import { CUSTOM_PAGE_TEMPLATE_META } from "../utils/customPageTemplates";
import {
  AgendaNote,
  ChecklistItem,
  CustomPage,
  CustomPageContentMap,
  CustomPageTemplate,
  FinanceEntry,
  KanbanCard,
  KanbanColumn,
  SimpleGoal,
} from "../types";

const SAVE_DEBOUNCE_MS = 600;

/**
 * Página personalizada creada desde "+ Nueva página" (ver AppShell/CreatePageModal). Se comporta
 * como un "shell" delgado: carga la fila completa (con `content`) y delega el cuerpo a la
 * plantilla que corresponda a `template` — cada una es "controlada" (recibe su parte de
 * `content` y devuelve el objeto completo actualizado vía `onChange`), y este componente es el
 * único que sabe guardar (debounced, igual que ProjectPages con el contenido de una libreta).
 */
export function CustomPagePage({
  pageId,
  onRenamed,
  onDeleted,
}: {
  pageId: number;
  // Avisa al menú lateral (ver AppShell) de que el título ha cambiado, para refrescar la lista.
  onRenamed: () => void;
  // Avisa de que la página se ha borrado, para quitarla del menú y volver a "Hoy".
  onDeleted: () => void;
}) {
  const { data: page, loading, error } = useFetch(() => api.get<CustomPage>(`/custom-pages/${pageId}`), [pageId]);

  const [title, setTitle] = useState("");
  const [content, setContent] = useState<CustomPageContentMap[CustomPageTemplate] | null>(null);
  const [savingState, setSavingState] = useState<"idle" | "saving" | "saved">("idle");
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sincroniza el estado local editable en cuanto llega (o cambia) la página del servidor.
  useEffect(() => {
    if (page) {
      setTitle(page.title);
      setContent(page.content);
    }
  }, [page]);

  const scheduleSave = (nextContent: CustomPageContentMap[CustomPageTemplate]) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setSavingState("saving");
    saveTimer.current = setTimeout(async () => {
      await api.put(`/custom-pages/${pageId}`, { content: nextContent });
      setSavingState("saved");
    }, SAVE_DEBOUNCE_MS);
  };

  const updateContent = (next: CustomPageContentMap[CustomPageTemplate]) => {
    setContent(next);
    scheduleSave(next);
  };

  // El título se guarda al perder el foco (no en cada tecla), igual que el de una página de
  // proyecto — ver ProjectPages.saveTitle.
  const saveTitle = async () => {
    const trimmed = title.trim();
    if (!page) return;
    if (!trimmed) {
      setTitle(page.title);
      return;
    }
    if (trimmed === page.title) return;
    await api.put(`/custom-pages/${pageId}`, { title: trimmed });
    onRenamed();
  };

  const removePage = async () => {
    await api.delete(`/custom-pages/${pageId}`);
    onDeleted();
  };

  if (loading) return <Loading label="Abriendo página..." />;
  if (error) return <ErrorMessage message={error} />;
  if (!page || content === null) return null;

  const meta = CUSTOM_PAGE_TEMPLATE_META[page.template];

  return (
    <div>
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={saveTitle}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            }}
            className="w-full min-w-0 border-b border-transparent bg-transparent font-serif text-4xl outline-none focus:border-primary"
          />
          <p className="mt-2 text-sm text-muted-foreground">
            <span aria-hidden="true">{meta.icon}</span> {meta.label}
            {savingState === "saving" && " · Guardando..."}
            {savingState === "saved" && " · Guardado"}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-3">
          <button
            onClick={() => {
              if (!confirmingDelete) {
                setConfirmingDelete(true);
                return;
              }
              removePage();
            }}
            onBlur={() => setConfirmingDelete(false)}
            className={`cursor-pointer whitespace-nowrap rounded-full px-4 py-2 text-xs transition-colors ${
              confirmingDelete
                ? "bg-destructive text-destructive-foreground"
                : "border border-border text-muted-foreground hover:text-destructive"
            }`}
          >
            {confirmingDelete ? "¿Confirmar eliminar?" : "Eliminar página"}
          </button>

          {/* "+ Columna" va debajo de "Eliminar página" (no al final del tablero) — es una
              acción sobre la página entera, como el propio borrado, no algo que dependa de
              desplazarse hasta el final de las columnas. */}
          {page.template === "kanban" && (
            <KanbanAddColumnForm
              onAdd={(columnTitle) => {
                const current = content as CustomPageContentMap["kanban"];
                updateContent({ columns: [...current.columns, { id: newId(), title: columnTitle, cards: [] }] });
              }}
            />
          )}
        </div>
      </div>

      {page.template === "nota" && (
        <RichTextEditor
          value={(content as CustomPageContentMap["nota"]).html}
          onChange={(html) => updateContent({ html })}
          placeholder="Escribe aquí…"
        />
      )}
      {page.template === "kanban" && (
        <KanbanTemplate
          columns={(content as CustomPageContentMap["kanban"]).columns}
          onChange={(columns) => updateContent({ columns })}
        />
      )}
      {page.template === "finanzas" && (
        <FinanceTemplate
          entries={(content as CustomPageContentMap["finanzas"]).entries}
          onChange={(entries) => updateContent({ entries })}
        />
      )}
      {page.template === "objetivos" && (
        <GoalsTemplate goals={(content as CustomPageContentMap["objetivos"]).goals} onChange={(goals) => updateContent({ goals })} />
      )}
      {page.template === "agenda" && (
        <AgendaNotesTemplate
          items={(content as CustomPageContentMap["agenda"]).items}
          onChange={(items) => updateContent({ items })}
        />
      )}
      {page.template === "proyectos" && (
        <ChecklistTemplate
          emptyLabel="Añade tareas para seguir el progreso."
          items={(content as CustomPageContentMap["proyectos"]).items}
          onChange={(items) => updateContent({ items })}
        />
      )}
      {page.template === "hoy" && (
        <ChecklistTemplate
          emptyLabel="Añade lo que tengas que hacer hoy."
          items={(content as CustomPageContentMap["hoy"]).items}
          onChange={(items) => updateContent({ items })}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// Checklist genérico — usado por las plantillas "proyectos" y "hoy" (misma forma de datos, solo
// cambia el mensaje de la lista vacía).
// ---------------------------------------------------------------------------------------------
function ChecklistTemplate({
  items,
  onChange,
  emptyLabel,
}: {
  items: ChecklistItem[];
  onChange: (items: ChecklistItem[]) => void;
  emptyLabel: string;
}) {
  const [text, setText] = useState("");

  const addItem = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return;
    onChange([...items, { id: newId(), text: trimmed, done: false }]);
    setText("");
  };

  const toggle = (id: string) => onChange(items.map((it) => (it.id === id ? { ...it, done: !it.done } : it)));
  const remove = (id: string) => onChange(items.filter((it) => it.id !== id));

  return (
    <div className="card-soft">
      <form onSubmit={addItem} className="mb-4 flex gap-2">
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Añadir..." className="field-input flex-1" />
        <button type="submit" className="btn-dark shrink-0">
          + Añadir
        </button>
      </form>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{emptyLabel}</p>
      ) : (
        <ul className="space-y-2">
          {items.map((it) => (
            <li key={it.id} className="group flex items-center gap-3 rounded-xl border border-border bg-background px-3 py-2.5 text-sm">
              <button
                type="button"
                onClick={() => toggle(it.id)}
                title={it.done ? "Desmarcar" : "Marcar como hecho"}
                className={`flex size-5 shrink-0 cursor-pointer items-center justify-center rounded-full border text-[10px] transition-colors ${
                  it.done ? "border-primary bg-primary/20 text-primary" : "border-foreground/30 hover:border-primary/60"
                }`}
              >
                {it.done ? "✓" : ""}
              </button>
              <span className={`min-w-0 flex-1 truncate ${it.done ? "text-muted-foreground line-through" : ""}`}>{it.text}</span>
              <button
                type="button"
                onClick={() => remove(it.id)}
                title="Eliminar"
                className="shrink-0 cursor-pointer text-xs opacity-0 transition-opacity group-hover:opacity-60 hover:!opacity-100"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// Objetivos — metas propias de la página, con barra de progreso (no tocan el modelo Goal real).
// ---------------------------------------------------------------------------------------------
function GoalsTemplate({ goals, onChange }: { goals: SimpleGoal[]; onChange: (goals: SimpleGoal[]) => void }) {
  const [title, setTitle] = useState("");
  const [target, setTarget] = useState("");

  const addGoal = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = title.trim();
    const n = Number(target);
    if (!trimmed || !Number.isFinite(n) || n <= 0) return;
    onChange([...goals, { id: newId(), title: trimmed, target: n, current: 0 }]);
    setTitle("");
    setTarget("");
  };

  const bump = (id: string) =>
    onChange(goals.map((g) => (g.id === id ? { ...g, current: Math.min(g.target, g.current + 1) } : g)));
  const remove = (id: string) => onChange(goals.filter((g) => g.id !== id));

  return (
    <div className="space-y-4">
      <form onSubmit={addGoal} className="grid gap-3 card-soft sm:grid-cols-[1fr_140px_auto]">
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Nombre del objetivo" className="field-input" />
        <input
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          type="number"
          min={1}
          placeholder="Meta"
          className="field-input"
        />
        <button type="submit" className="btn-dark">
          + Añadir
        </button>
      </form>

      {goals.length === 0 ? (
        <EmptyState message="Todavía no tienes objetivos en esta página." />
      ) : (
        <div className="space-y-3">
          {goals.map((g) => {
            const pct = g.target > 0 ? Math.min(100, Math.round((g.current / g.target) * 100)) : 0;
            return (
              <div key={g.id} className="card-soft">
                <div className="mb-2 flex items-center justify-between gap-4">
                  <p className="min-w-0 truncate font-medium">{g.title}</p>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {g.current} / {g.target}
                  </span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => bump(g.id)}
                    disabled={g.current >= g.target}
                    className="cursor-pointer rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/20 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    +1
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(g.id)}
                    className="cursor-pointer text-xs text-muted-foreground hover:text-destructive"
                  >
                    Eliminar
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// Finanzas — ingresos/gastos propios de la página, con balance (no tocan Transaction real).
// ---------------------------------------------------------------------------------------------
function FinanceTemplate({ entries, onChange }: { entries: FinanceEntry[]; onChange: (entries: FinanceEntry[]) => void }) {
  const [type, setType] = useState<"income" | "expense">("expense");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");

  const add = (e: FormEvent) => {
    e.preventDefault();
    const n = Number(amount);
    const trimmedCategory = category.trim();
    if (!Number.isFinite(n) || n <= 0 || !trimmedCategory) return;
    onChange([{ id: newId(), type, amount: n, category: trimmedCategory, description: description.trim() }, ...entries]);
    setAmount("");
    setCategory("");
    setDescription("");
  };

  const remove = (id: string) => onChange(entries.filter((entry) => entry.id !== id));

  const balance = entries.reduce((sum, entry) => sum + (entry.type === "income" ? entry.amount : -entry.amount), 0);
  const formatMoney = (n: number) => n.toLocaleString("es-ES", { style: "currency", currency: "EUR" });

  return (
    <div className="space-y-6">
      <div className="card-soft flex items-center justify-between">
        <span className="text-sm text-muted-foreground">Balance</span>
        <span className={`font-serif text-2xl ${balance >= 0 ? "text-primary" : "text-destructive"}`}>{formatMoney(balance)}</span>
      </div>

      <form onSubmit={add} className="grid gap-3 card-soft sm:grid-cols-[120px_120px_1fr_1fr_auto]">
        <select value={type} onChange={(e) => setType(e.target.value as "income" | "expense")} className="field-input">
          <option value="income">Ingreso</option>
          <option value="expense">Gasto</option>
        </select>
        <input
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          type="number"
          min={0}
          step="0.01"
          placeholder="Importe"
          className="field-input"
        />
        <input
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          placeholder="Categoría"
          className="field-input"
        />
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Descripción (opcional)"
          className="field-input"
        />
        <button type="submit" className="btn-dark">
          + Añadir
        </button>
      </form>

      {entries.length === 0 ? (
        <EmptyState message="Todavía no has apuntado ningún movimiento." />
      ) : (
        <ul className="space-y-2">
          {entries.map((entry) => (
            <li
              key={entry.id}
              className="group flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3 text-sm"
            >
              <div className="min-w-0">
                <p className="truncate font-medium">{entry.category}</p>
                {entry.description && <p className="truncate text-xs text-muted-foreground">{entry.description}</p>}
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <span className={`font-medium ${entry.type === "income" ? "text-primary" : "text-destructive"}`}>
                  {entry.type === "income" ? "+" : "-"}
                  {formatMoney(entry.amount)}
                </span>
                <button
                  type="button"
                  onClick={() => remove(entry.id)}
                  title="Eliminar"
                  className="cursor-pointer text-xs opacity-0 transition-opacity group-hover:opacity-60 hover:!opacity-100"
                >
                  ✕
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// Agenda — notas sueltas con fecha, propias de la página (no tocan Event/Note reales).
// ---------------------------------------------------------------------------------------------
function AgendaNotesTemplate({ items, onChange }: { items: AgendaNote[]; onChange: (items: AgendaNote[]) => void }) {
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [text, setText] = useState("");

  const add = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return;
    onChange([...items, { id: newId(), date, text: trimmed }]);
    setText("");
  };

  const remove = (id: string) => onChange(items.filter((it) => it.id !== id));

  const sorted = [...items].sort((a, b) => a.date.localeCompare(b.date));

  return (
    <div className="space-y-4">
      <form onSubmit={add} className="grid gap-3 card-soft sm:grid-cols-[160px_1fr_auto]">
        <input value={date} onChange={(e) => setDate(e.target.value)} type="date" className="field-input" />
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="¿Qué apuntas?" className="field-input" />
        <button type="submit" className="btn-dark">
          + Añadir
        </button>
      </form>

      {sorted.length === 0 ? (
        <EmptyState message="Todavía no hay notas en esta agenda." />
      ) : (
        <ul className="space-y-2">
          {sorted.map((it) => (
            <li key={it.id} className="group flex items-center gap-4 rounded-xl border border-border bg-card px-4 py-3 text-sm">
              <span className="shrink-0 rounded-full bg-secondary px-3 py-1 text-xs">
                {new Date(`${it.date}T00:00:00`).toLocaleDateString("es-ES", { day: "numeric", month: "short" })}
              </span>
              <span className="min-w-0 flex-1 truncate">{it.text}</span>
              <button
                type="button"
                onClick={() => remove(it.id)}
                title="Eliminar"
                className="shrink-0 cursor-pointer text-xs opacity-0 transition-opacity group-hover:opacity-60 hover:!opacity-100"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// Mismos colores que el tablero del Planificador (ver COLUMN_STYLES/COLUMN_HEADER_STYLES en
// PlanificadorPage: neutro/amarillo/verde) — aquí se ciclan por posición en vez de por un
// `status` fijo, porque una página de kanban puede tener cualquier número de columnas con el
// nombre que el usuario quiera.
const KANBAN_COLUMN_STYLES = [
  { box: "border-border bg-card", header: "text-foreground" },
  { box: "border-warning/30 bg-warning/10", header: "text-warning" },
  { box: "border-positive/30 bg-positive/10", header: "text-positive" },
];

// Igual límite y mecánica que RichTextEditor.insertImage: se embebe como data URL dentro del
// propio JSON de la tarjeta (CustomPage.content), no hay subida a un storage aparte.
const MAX_IMAGE_BYTES = 3 * 1024 * 1024; // 3MB

function readImageFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

// ---------------------------------------------------------------------------------------------
// Kanban — tablero propio de columnas/tarjetas (no reutiliza Task/Planificador, ver comentario
// en el schema de Prisma) con drag & drop entre columnas y el mismo aspecto (colores, anchura de
// columna) que el tablero del Planificador.
// ---------------------------------------------------------------------------------------------
function KanbanTemplate({ columns, onChange }: { columns: KanbanColumn[]; onChange: (columns: KanbanColumn[]) => void }) {
  const [draggedCard, setDraggedCard] = useState<{ columnId: string; cardId: string } | null>(null);
  const [confirmingColumnId, setConfirmingColumnId] = useState<string | null>(null);

  const renameColumn = (columnId: string, title: string) => onChange(columns.map((c) => (c.id === columnId ? { ...c, title } : c)));

  const removeColumn = (columnId: string) => {
    onChange(columns.filter((c) => c.id !== columnId));
    setConfirmingColumnId(null);
  };

  // Igual patrón que el borrado de páginas en ProjectPages: columna vacía se borra directamente,
  // con tarjetas dentro pide confirmar con un segundo clic.
  const handleDeleteColumnClick = (e: React.MouseEvent, column: KanbanColumn) => {
    e.stopPropagation();
    if (column.cards.length === 0 || confirmingColumnId === column.id) {
      removeColumn(column.id);
    } else {
      setConfirmingColumnId(column.id);
    }
  };

  const addCard = (columnId: string, text: string, description: string) => {
    onChange(
      columns.map((c) =>
        c.id === columnId
          ? { ...c, cards: [...c.cards, { id: newId(), text, image: null, description: description || undefined }] }
          : c
      )
    );
  };

  const removeCard = (columnId: string, cardId: string) => {
    onChange(columns.map((c) => (c.id === columnId ? { ...c, cards: c.cards.filter((card) => card.id !== cardId) } : c)));
  };

  // Cualquier cambio sobre una tarjeta existente (texto, imagen, descripción o notas) pasa por
  // aquí — el diálogo de detalles (KanbanCardDialog) llama a esto con solo los campos que ha tocado.
  const updateCard = (columnId: string, cardId: string, fields: Partial<Pick<KanbanCard, "text" | "image" | "description" | "notes">>) => {
    onChange(
      columns.map((c) =>
        c.id === columnId
          ? { ...c, cards: c.cards.map((card) => (card.id === cardId ? { ...card, ...fields } : card)) }
          : c
      )
    );
  };

  const dropOnColumn = (toColumnId: string) => {
    if (!draggedCard) return;
    const { columnId: fromColumnId, cardId } = draggedCard;
    setDraggedCard(null);
    if (fromColumnId === toColumnId) return;
    const fromColumn = columns.find((c) => c.id === fromColumnId);
    const card = fromColumn?.cards.find((c) => c.id === cardId);
    if (!card) return;
    onChange(
      columns.map((c) => {
        if (c.id === fromColumnId) return { ...c, cards: c.cards.filter((cc) => cc.id !== cardId) };
        if (c.id === toColumnId) return { ...c, cards: [...c.cards, card] };
        return c;
      })
    );
  };

  return (
    // Mismo grid que PlanificadorPage (grid gap-6 md:grid-cols-3): cada columna ocupa el mismo
    // ancho que allí en vez de una tira estrecha con scroll horizontal. Con más de 3 columnas
    // simplemente pasan a la fila siguiente. El formulario "+ Columna" vive en la cabecera de la
    // página (ver CustomPagePage), debajo de "Eliminar página" — no aquí.
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {columns.map((column, index) => (
        <KanbanColumnView
          key={column.id}
          column={column}
          style={KANBAN_COLUMN_STYLES[index % KANBAN_COLUMN_STYLES.length]}
          confirmingDelete={confirmingColumnId === column.id}
          draggedCardId={draggedCard?.cardId ?? null}
          onDragStartCard={(cardId) => setDraggedCard({ columnId: column.id, cardId })}
          onDropCard={() => dropOnColumn(column.id)}
          onRename={(title) => renameColumn(column.id, title)}
          onDeleteClick={(e) => handleDeleteColumnClick(e, column)}
          onDeleteBlur={() => setConfirmingColumnId((id) => (id === column.id ? null : id))}
          onAddCard={(text, description) => addCard(column.id, text, description)}
          onRemoveCard={(cardId) => removeCard(column.id, cardId)}
          onCardUpdate={(cardId, fields) => updateCard(column.id, cardId, fields)}
        />
      ))}
    </div>
  );
}

// Formulario de "+ Columna" — vive en la cabecera de la página (junto a "Eliminar página"), así
// que es puramente presentacional: no conoce `columns`, solo pide un título y avisa al padre.
function KanbanAddColumnForm({ onAdd }: { onAdd: (title: string) => void }) {
  const [title, setTitle] = useState("");

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) return;
    onAdd(trimmed);
    setTitle("");
  };

  return (
    <form onSubmit={submit} className="flex gap-2">
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Nueva columna"
        className="field-input w-40 text-sm"
      />
      <button type="submit" className="btn-dark shrink-0 px-3 py-2 text-xs">
        + Columna
      </button>
    </form>
  );
}

function KanbanColumnView({
  column,
  style,
  confirmingDelete,
  draggedCardId,
  onDragStartCard,
  onDropCard,
  onRename,
  onDeleteClick,
  onDeleteBlur,
  onAddCard,
  onRemoveCard,
  onCardUpdate,
}: {
  column: KanbanColumn;
  style: { box: string; header: string };
  confirmingDelete: boolean;
  draggedCardId: string | null;
  onDragStartCard: (cardId: string) => void;
  onDropCard: () => void;
  onRename: (title: string) => void;
  onDeleteClick: (e: React.MouseEvent) => void;
  onDeleteBlur: () => void;
  onAddCard: (text: string, description: string) => void;
  onRemoveCard: (cardId: string) => void;
  onCardUpdate: (cardId: string, fields: Partial<Pick<KanbanCard, "text" | "image" | "description" | "notes">>) => void;
}) {
  const [dragOver, setDragOver] = useState(false);
  const [adding, setAdding] = useState(false);
  const [cardText, setCardText] = useState("");
  const [cardDescription, setCardDescription] = useState("");

  const submitCard = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = cardText.trim();
    if (!trimmed) return;
    onAddCard(trimmed, cardDescription.trim());
    setCardText("");
    setCardDescription("");
    setAdding(false);
  };

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        onDropCard();
      }}
      className={`flex flex-col gap-3 rounded-3xl border p-4 transition-colors ${dragOver ? "border-primary/50 bg-primary/5" : style.box}`}
    >
      <div className="flex items-center justify-between gap-2 px-1">
        <input
          value={column.title}
          onChange={(e) => onRename(e.target.value)}
          className={`min-w-0 flex-1 truncate bg-transparent text-sm font-medium outline-none focus:underline ${style.header}`}
        />
        <span className="shrink-0 text-xs text-muted-foreground">{column.cards.length}</span>
        <span
          role="button"
          title={confirmingDelete ? "Confirmar eliminar" : "Eliminar columna"}
          onClick={onDeleteClick}
          onMouseLeave={onDeleteBlur}
          className={`shrink-0 cursor-pointer text-xs ${
            confirmingDelete ? "font-bold text-destructive" : "text-muted-foreground opacity-60 hover:opacity-100"
          }`}
        >
          ✕
        </span>
      </div>

      <div className="flex min-h-16 flex-col gap-2">
        {column.cards.length === 0 && !dragOver && (
          <p className="rounded-xl border border-dashed border-border px-3 py-6 text-center text-xs text-muted-foreground">
            Sin tarjetas
          </p>
        )}
        {column.cards.map((card: KanbanCard) => (
          <KanbanCardItem
            key={card.id}
            card={card}
            isDragged={draggedCardId === card.id}
            onDragStart={() => onDragStartCard(card.id)}
            onRemove={() => onRemoveCard(card.id)}
            onUpdate={(fields) => onCardUpdate(card.id, fields)}
          />
        ))}
      </div>

      {!adding ? (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="w-full cursor-pointer rounded-xl border border-dashed border-border px-3 py-2 text-center text-xs text-muted-foreground transition-colors hover:border-primary/30 hover:text-foreground"
        >
          + Tarjeta
        </button>
      ) : (
        <form onSubmit={submitCard} className="space-y-2">
          <input
            autoFocus
            value={cardText}
            onChange={(e) => setCardText(e.target.value)}
            placeholder="Título de la tarjeta"
            className="field-input w-full text-sm"
          />
          <textarea
            value={cardDescription}
            onChange={(e) => setCardDescription(e.target.value)}
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
                setCardText("");
                setCardDescription("");
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

// La tarjeta es solo una vista previa (texto + imagen) — clicarla abre KanbanCardDialog, donde
// vive la edición de verdad (texto, imagen, notas). Mismo reparto vista-previa/diálogo que
// TaskCard/TaskDetailDialog en el Planificador.
function KanbanCardItem({
  card,
  isDragged,
  onDragStart,
  onRemove,
  onUpdate,
}: {
  card: KanbanCard;
  isDragged: boolean;
  onDragStart: () => void;
  onRemove: () => void;
  onUpdate: (fields: Partial<Pick<KanbanCard, "text" | "image" | "description" | "notes">>) => void;
}) {
  const [detailOpen, setDetailOpen] = useState(false);

  return (
    <>
      <div
        draggable
        onDragStart={(e) => {
          e.dataTransfer.setData("text/plain", card.id);
          onDragStart();
        }}
        onClick={() => setDetailOpen(true)}
        title="Haz clic para ver los detalles"
        className={`group cursor-grab rounded-xl border border-border bg-background p-3 text-sm transition-all active:cursor-grabbing ${isDragged ? "opacity-40" : ""}`}
      >
        {card.image && <img src={card.image} alt="" className="mb-2 max-h-40 w-full rounded-lg object-cover" />}

        <div className="flex items-start justify-between gap-2">
          <span className="min-w-0 flex-1 whitespace-pre-wrap break-words">{card.text}</span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            title="Eliminar tarjeta"
            className="shrink-0 cursor-pointer text-xs opacity-0 transition-opacity group-hover:opacity-60 hover:!opacity-100"
          >
            ✕
          </button>
        </div>

        {card.description && <p className="mt-1.5 truncate text-xs text-muted-foreground">{card.description}</p>}

        {card.notes && <span className="mt-2 inline-block text-xs text-muted-foreground">📝</span>}
      </div>

      {detailOpen && <KanbanCardDialog card={card} onClose={() => setDetailOpen(false)} onUpdate={onUpdate} onRemove={onRemove} />}
    </>
  );
}

/**
 * Diálogo de detalles de una tarjeta de kanban personalizado — mismo reparto de campos que
 * TaskDetailDialog en el Planificador, pero solo con lo que se decidió compartir entre ambos:
 * texto de la tarjeta, imagen y el recuadro grande SIN nombre para notas libres. Fecha
 * límite/prioridad/subtareas/tiempo siguen siendo exclusivos del Planificador.
 */
function KanbanCardDialog({
  card,
  onClose,
  onUpdate,
  onRemove,
}: {
  card: KanbanCard;
  onClose: () => void;
  onUpdate: (fields: Partial<Pick<KanbanCard, "text" | "image" | "description" | "notes">>) => void;
  onRemove: () => void;
}) {
  const [text, setText] = useState(card.text);
  const [description, setDescription] = useState(card.description ?? "");
  const [notes, setNotes] = useState(card.notes ?? "");
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // El textarea de notas es redimensionable en ambas direcciones (ver className más abajo), para
  // agrandarlo o para encogerlo. Igual que en TaskDetailDialog del Planificador: el propio
  // diálogo sigue ese ancho en vez de dejar que el texto se salga por fuera (al agrandar) o que
  // quede un hueco de sobra alrededor (al encoger) — aquí no hay una segunda columna con la que
  // chocar, así que basta con ajustar el ancho del diálogo entero.
  const modalRef = useRef<HTMLDivElement>(null);
  const notesRef = useRef<HTMLTextAreaElement>(null);
  const naturalSizeRef = useRef<{ modalWidth: number; notesWidth: number } | null>(null);
  const [customModalWidth, setCustomModalWidth] = useState<number | null>(null);

  useEffect(() => {
    const notesEl = notesRef.current;
    if (!notesEl) return;
    const observer = new ResizeObserver(() => {
      if (!modalRef.current) return;
      // La primera medida (antes de que el usuario toque el tirador) es la referencia "de
      // fábrica" con la que comparar cuánto se ha movido, en cualquiera de los dos sentidos.
      if (!naturalSizeRef.current) {
        naturalSizeRef.current = { modalWidth: modalRef.current.getBoundingClientRect().width, notesWidth: notesEl.getBoundingClientRect().width };
        return;
      }
      const { modalWidth, notesWidth } = naturalSizeRef.current;
      const delta = notesEl.getBoundingClientRect().width - notesWidth;
      if (Math.abs(delta) <= 2) {
        setCustomModalWidth(null);
        return;
      }
      // Al agrandar, tope en el 95% del ancho de la ventana; al encoger, el propio `min-w-*`
      // del textarea ya pone el límite.
      const maxModalWidth = window.innerWidth * 0.95;
      const clampedDelta = delta > 0 ? Math.min(delta, Math.max(maxModalWidth - modalWidth, 0)) : delta;
      setCustomModalWidth(modalWidth + clampedDelta);
    });
    observer.observe(notesEl);
    return () => observer.disconnect();
  }, []);

  const saveText = () => {
    const trimmed = text.trim();
    if (!trimmed) {
      setText(card.text);
      return;
    }
    if (trimmed === card.text) return;
    onUpdate({ text: trimmed });
  };

  const saveDescription = () => {
    const trimmed = description.trim();
    if (trimmed === (card.description ?? "")) return;
    onUpdate({ description: trimmed || undefined });
  };

  const saveNotes = () => {
    if (notes === (card.notes ?? "")) return;
    onUpdate({ notes: notes || null });
  };

  const handleImageFile = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) return;
    if (file.size > MAX_IMAGE_BYTES) {
      window.alert("La imagen es demasiado grande (máx. 3 MB).");
      return;
    }
    onUpdate({ image: await readImageFile(file) });
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
        style={customModalWidth ? { width: `${customModalWidth}px`, maxWidth: "95vw" } : undefined}
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl bg-card p-6 shadow-[var(--shadow-soft)] sm:p-8"
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onBlur={saveText}
            rows={1}
            className="min-w-0 flex-1 resize-none border-b border-transparent bg-transparent font-serif text-2xl outline-none focus:border-primary"
          />
          <button type="button" onClick={onClose} className="shrink-0 cursor-pointer text-xs text-muted-foreground hover:text-foreground">
            ✕ Cerrar
          </button>
        </div>

        {card.image && <img src={card.image} alt="" className="mb-3 max-h-56 w-full rounded-xl object-cover" />}
        <div className="mb-5 flex items-center gap-3 text-xs">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="cursor-pointer text-muted-foreground hover:text-foreground"
          >
            {card.image ? "🖼 Cambiar imagen" : "🖼 Añadir imagen"}
          </button>
          {card.image && (
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
              void handleImageFile(e.target.files?.[0]);
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
            `w-full` es solo el ancho DE PARTIDA; `resize` (no solo `resize-y`) deja tirar tanto
            del ancho como del alto — al arrastrar, el navegador fija un ancho en línea que manda
            por encima de `w-full`, así que puede bajar hasta el suelo de `min-w-[12rem]` o subir
            lo que haga falta. El `ResizeObserver` de arriba sigue ese ancho en ambos sentidos y
            ajusta el diálogo entero. */}
        <textarea
          ref={notesRef}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={saveNotes}
          rows={8}
          placeholder="Escribe aquí…"
          className="field-input mb-5 w-full min-w-[12rem] resize text-sm"
        />

        <div className="flex justify-end border-t border-border pt-4">
          <button
            onClick={() => {
              if (!confirmingDelete) {
                setConfirmingDelete(true);
                return;
              }
              onRemove();
              onClose();
            }}
            onBlur={() => setConfirmingDelete(false)}
            className={`cursor-pointer whitespace-nowrap rounded-full px-4 py-1.5 text-xs transition-colors ${
              confirmingDelete
                ? "bg-destructive text-destructive-foreground"
                : "border border-border text-muted-foreground hover:text-destructive"
            }`}
          >
            {confirmingDelete ? "¿Confirmar eliminar?" : "Eliminar tarjeta"}
          </button>
        </div>
      </div>
    </div>
  );
}
