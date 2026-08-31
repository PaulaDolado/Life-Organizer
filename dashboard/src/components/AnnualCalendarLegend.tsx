import { FormEvent, useEffect, useRef, useState } from "react";
import { api } from "../api/client";
import { useFetch } from "../hooks/useFetch";
import { Loading, ErrorMessage } from "./Feedback";
import { CALENDAR_COLOR_CLASSES, CALENDAR_COLOR_OPTIONS } from "../utils/calendarColors";
import { CalendarColor, CalendarDayMark, CalendarLegendCategory } from "../types";

const MONTH_NAMES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];
const DAY_LETTERS = ["L", "M", "X", "J", "V", "S", "D"];

// Formato local YYYY-MM-DD — a propósito NO usa `Date.toISOString()` (esa convierte a UTC antes
// de recortar la fecha, así que cerca de medianoche podría devolver el día de al lado según la
// zona horaria del navegador). Aquí trabajamos siempre con piezas locales del Date.
function dateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// El calendario anual muestra un "curso" de 11 meses (septiembre a julio) en vez del año
// natural — septiembre es el inicio más habitual de un curso académico. `offset` desplaza el
// curso mostrado (0 = el curso en el que cae hoy, 1 = el siguiente, -1 = el anterior...).
// Agosto ya cuenta como parte del curso que EMPIEZA ese septiembre (no del que acaba de terminar
// en julio) — así en agosto de 2026 se ve septiembre 2026 - julio 2027, no el curso ya acabado.
function academicYearStart(offset: number): number {
  const now = new Date();
  const startYear = now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1;
  return startYear + offset;
}

function monthWeeks(year: number, month: number): (Date | null)[][] {
  const firstDay = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startWeekday = (firstDay.getDay() + 6) % 7; // 0 = lunes ... 6 = domingo
  const cells: (Date | null)[] = Array(startWeekday).fill(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: (Date | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

/**
 * Vista anual con leyenda (Horario > debajo de los horarios): un calendario de curso completo
 * (septiembre a julio) donde cada día se puede pintar con una categoría de la leyenda —
 * "Clase", "Vacaciones", "Festivos"... las categorías las crea el usuario con el color que
 * quiera de la paleta de la app (ver CALENDAR_COLOR_OPTIONS). Compartida para toda la cuenta:
 * no depende de qué horario (trimestre/semestre) esté abierto arriba.
 */
export function AnnualCalendarLegend() {
  const { data: categoriesData, loading, error, reload: reloadCategories } = useFetch(
    () => api.get<{ categories: CalendarLegendCategory[] }>("/calendar-legend"),
    []
  );
  const categories = categoriesData?.categories ?? [];

  const [yearOffset, setYearOffset] = useState(0);
  const startYear = academicYearStart(yearOffset);

  const { data: marksData, reload: reloadMarks } = useFetch(
    () =>
      api.get<{ marks: CalendarDayMark[] }>(
        `/calendar-legend/marks?from=${startYear}-09-01&to=${startYear + 1}-07-31`
      ),
    [yearOffset]
  );

  // Copia local optimista: pintar (o arrastrar sobre varios días) actualiza esto al instante sin
  // esperar a la respuesta del servidor ni recargar toda la lista en cada día tocado.
  const [marks, setMarks] = useState<Map<string, number>>(new Map());
  useEffect(() => {
    if (marksData) setMarks(new Map(marksData.marks.map((m) => [m.date, m.categoryId])));
  }, [marksData]);

  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [renamingCategoryId, setRenamingCategoryId] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<number | null>(null);
  // Igual que renombrar: clic en el color de una categoría abre un mini selector con la misma
  // paleta que al crearla (ver CALENDAR_COLOR_OPTIONS), en vez de tener que borrarla y recrearla.
  const [editingColorCategoryId, setEditingColorCategoryId] = useState<number | null>(null);
  const colorPickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (editingColorCategoryId === null) return;
    const closeOnOutsideClick = (e: MouseEvent) => {
      if (colorPickerRef.current && !colorPickerRef.current.contains(e.target as Node)) setEditingColorCategoryId(null);
    };
    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, [editingColorCategoryId]);

  const applyMark = (key: string, categoryId: number | null) => {
    setMarks((prev) => {
      const next = new Map(prev);
      if (categoryId === null) next.delete(key);
      else next.set(key, categoryId);
      return next;
    });
    api.put(`/calendar-legend/marks/${key}`, { categoryId }).catch(() => reloadMarks());
  };

  // Arrastrar sobre varios días pinta (o borra) todos con el mismo valor que decidió el primer
  // día tocado — así "pintar" y "despintar" son el mismo gesto: si el primer día ya tenía la
  // categoría seleccionada, arrastrar la quita; si no la tenía, arrastrar la pone.
  const paintRef = useRef<{ active: boolean; value: number | null } | null>(null);

  useEffect(() => {
    const stopPainting = () => {
      if (paintRef.current) paintRef.current.active = false;
    };
    window.addEventListener("mouseup", stopPainting);
    return () => window.removeEventListener("mouseup", stopPainting);
  }, []);

  const startPaint = (key: string) => {
    if (selectedCategoryId === null) return;
    const value = marks.get(key) === selectedCategoryId ? null : selectedCategoryId;
    paintRef.current = { active: true, value };
    applyMark(key, value);
  };

  const continuePaint = (key: string) => {
    if (!paintRef.current?.active) return;
    applyMark(key, paintRef.current.value);
  };

  const addCategory = async (label: string, color: CalendarColor) => {
    await api.post("/calendar-legend", { label, color });
    reloadCategories();
  };

  const renameCategory = async (id: number, label: string) => {
    await api.put(`/calendar-legend/${id}`, { label });
    reloadCategories();
  };

  const changeCategoryColor = async (id: number, color: CalendarColor) => {
    setEditingColorCategoryId(null);
    await api.put(`/calendar-legend/${id}`, { color });
    reloadCategories();
  };

  const deleteCategory = async (id: number) => {
    await api.delete(`/calendar-legend/${id}`);
    if (selectedCategoryId === id) setSelectedCategoryId(null);
    reloadCategories();
    reloadMarks();
  };

  if (loading) return <Loading label="Cargando calendario anual..." />;
  if (error) return <ErrorMessage message={error} />;

  return (
    <section className="mt-10">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h2 className="font-serif text-2xl">Calendario anual</h2>
        <div className="flex items-center gap-2 text-sm">
          <button
            onClick={() => setYearOffset((v) => v - 1)}
            className="cursor-pointer rounded-full border border-border px-3 py-1.5 text-muted-foreground transition-colors hover:border-primary/30 hover:text-foreground"
          >
            ‹
          </button>
          <span className="min-w-[110px] text-center font-medium">
            {startYear}–{startYear + 1}
          </span>
          <button
            onClick={() => setYearOffset((v) => v + 1)}
            className="cursor-pointer rounded-full border border-border px-3 py-1.5 text-muted-foreground transition-colors hover:border-primary/30 hover:text-foreground"
          >
            ›
          </button>
          {yearOffset !== 0 && (
            <button onClick={() => setYearOffset(0)} className="cursor-pointer text-xs text-muted-foreground underline hover:text-foreground">
              Curso actual
            </button>
          )}
        </div>
      </div>

      <p className="mb-4 text-xs text-muted-foreground">
        {selectedCategoryId === null
          ? "Elige una categoría de la leyenda de abajo y haz clic (o arrastra) sobre los días para pintarlos."
          : "Haz clic o arrastra sobre los días para pintarlos — clic otra vez sobre un día ya pintado lo despinta."}
      </p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 11 }, (_, i) => {
          const monthDate = new Date(startYear, 8 + i, 1);
          const year = monthDate.getFullYear();
          const month = monthDate.getMonth();
          const weeks = monthWeeks(year, month);
          return (
            <div key={`${year}-${month}`} className="rounded-2xl border border-border bg-card p-3">
              <p className="mb-2 text-center text-xs font-bold uppercase tracking-widest text-muted-foreground">
                {MONTH_NAMES[month]} {year}
              </p>
              <table className="w-full border-collapse text-center text-[11px]">
                <thead>
                  <tr className="text-muted-foreground">
                    {DAY_LETTERS.map((l) => (
                      <th key={l} className="pb-1 font-medium">
                        {l}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {weeks.map((week, wi) => (
                    <tr key={wi}>
                      {week.map((day, di) => {
                        if (!day) return <td key={di} className="p-0.5" />;
                        const key = dateKey(day);
                        const categoryId = marks.get(key) ?? null;
                        const category = categories.find((c) => c.id === categoryId);
                        const classes = category
                          ? CALENDAR_COLOR_CLASSES[category.color]
                          : { cellBg: "hover:bg-muted", cellBorder: "border-transparent" };
                        return (
                          <td key={di} className="p-0.5">
                            <button
                              type="button"
                              onMouseDown={() => startPaint(key)}
                              onMouseEnter={() => continuePaint(key)}
                              title={category?.label}
                              // inline-flex, no flex: el botón centra su propio número por
                              // dentro (flex), pero de puertas afuera necesita seguir siendo un
                              // elemento "en línea" para que el text-center de la celda (heredado
                              // de la tabla) lo centre a él dentro de la celda — con flex a
                              // secas (caja de bloque) ese centrado del padre no se aplicaba y el
                              // número quedaba pegado al borde izquierdo de la celda, un pelín a
                              // la izquierda de la letra del día de la semana de arriba.
                              className={`inline-flex size-6 cursor-pointer select-none items-center justify-center rounded-md border transition-colors ${classes.cellBg} ${classes.cellBorder}`}
                            >
                              {day.getDate()}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        })}
      </div>

      <div className="mt-6 rounded-2xl border border-border bg-card p-4">
        <p className="mb-3 text-xs font-bold uppercase tracking-widest text-muted-foreground">Leyenda</p>
        <div className="flex flex-wrap items-center gap-2">
          {categories.map((category) => {
            const classes = CALENDAR_COLOR_CLASSES[category.color];
            const isSelected = selectedCategoryId === category.id;
            const isRenaming = renamingCategoryId === category.id;
            return (
              <div key={category.id} className="group relative">
                {isRenaming ? (
                  <input
                    autoFocus
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onBlur={async () => {
                      const trimmed = renameValue.trim();
                      setRenamingCategoryId(null);
                      if (trimmed && trimmed !== category.label) await renameCategory(category.id, trimmed);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                      if (e.key === "Escape") setRenamingCategoryId(null);
                    }}
                    className="rounded-full border border-primary bg-background px-3 py-1.5 text-sm outline-none"
                  />
                ) : (
                  <div
                    className={`flex items-center gap-2 rounded-full border py-1.5 pl-1.5 pr-4 text-sm transition-colors ${
                      isSelected ? "border-primary bg-primary/10" : "border-border hover:border-primary/30"
                    }`}
                  >
                    <button
                      type="button"
                      title="Cambiar color"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingColorCategoryId((id) => (id === category.id ? null : category.id));
                      }}
                      className={`size-4 shrink-0 cursor-pointer rounded-full transition-shadow hover:ring-2 hover:ring-foreground/40 ${classes.swatch}`}
                    />
                    <button
                      type="button"
                      onClick={() => setSelectedCategoryId((id) => (id === category.id ? null : category.id))}
                      className="cursor-pointer"
                    >
                      {category.label}
                    </button>
                  </div>
                )}
                {editingColorCategoryId === category.id && (
                  <div
                    ref={colorPickerRef}
                    className="absolute left-0 top-full z-10 mt-1 flex items-center gap-1 rounded-full border border-border bg-card p-1.5 shadow-[var(--shadow-soft)]"
                  >
                    {CALENDAR_COLOR_OPTIONS.map((opt) => (
                      <button
                        key={opt.key}
                        type="button"
                        title={opt.label}
                        onClick={() => changeCategoryColor(category.id, opt.key)}
                        className={`size-5 shrink-0 cursor-pointer rounded-full ${opt.swatch} ${
                          category.color === opt.key ? "ring-2 ring-foreground ring-offset-1 ring-offset-background" : ""
                        }`}
                      />
                    ))}
                  </div>
                )}
                {!isRenaming && (
                  // Arriba a la derecha, del todo por ENCIMA de la pastilla (no solo desplazado
                  // hacia arriba: -top-8 deja toda su altura por encima del borde superior) — así
                  // nunca se solapa con el nombre, sea corto o largo, sin reservarle hueco propio
                  // dentro de la pastilla.
                  <span className="absolute -right-1.5 -top-8 z-10 flex items-center gap-0.5 rounded-full border border-border bg-card px-0.5 py-0.5 opacity-0 shadow-[var(--shadow-soft)] transition-opacity group-hover:opacity-100">
                    <button
                      type="button"
                      title="Renombrar"
                      onClick={(e) => {
                        e.stopPropagation();
                        setRenamingCategoryId(category.id);
                        setRenameValue(category.label);
                      }}
                      className="cursor-pointer rounded p-1 text-xs text-muted-foreground hover:text-foreground"
                    >
                      ✎
                    </button>
                    <button
                      type="button"
                      title={confirmingDeleteId === category.id ? "Confirmar eliminar" : "Eliminar categoría"}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirmingDeleteId === category.id) {
                          setConfirmingDeleteId(null);
                          deleteCategory(category.id);
                        } else {
                          setConfirmingDeleteId(category.id);
                        }
                      }}
                      onMouseLeave={() => setConfirmingDeleteId((id) => (id === category.id ? null : id))}
                      className={`cursor-pointer rounded p-1 text-xs ${
                        confirmingDeleteId === category.id ? "font-bold text-destructive" : "text-muted-foreground hover:text-destructive"
                      }`}
                    >
                      ✕
                    </button>
                  </span>
                )}
              </div>
            );
          })}

          {showAddCategory ? (
            <AddCategoryForm
              onCancel={() => setShowAddCategory(false)}
              onAdd={async (label, color) => {
                await addCategory(label, color);
                setShowAddCategory(false);
              }}
            />
          ) : (
            <button
              onClick={() => setShowAddCategory(true)}
              className="cursor-pointer rounded-full border border-dashed border-primary/30 bg-primary/5 px-4 py-1.5 text-sm font-medium text-primary transition-colors hover:bg-primary/10"
            >
              + Categoría
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

function AddCategoryForm({ onAdd, onCancel }: { onAdd: (label: string, color: CalendarColor) => Promise<void>; onCancel: () => void }) {
  const [label, setLabel] = useState("");
  const [color, setColor] = useState<CalendarColor>(CALENDAR_COLOR_OPTIONS[0].key);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = label.trim();
    if (!trimmed) return;
    onAdd(trimmed, color);
  };

  return (
    <form onSubmit={submit} className="flex flex-wrap items-center gap-2 rounded-full border border-border bg-background px-3 py-1.5">
      <input
        autoFocus
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        placeholder="Nombre de la categoría"
        className="w-40 bg-transparent text-sm outline-none"
      />
      <div className="flex items-center gap-1">
        {CALENDAR_COLOR_OPTIONS.map((opt) => (
          <button
            key={opt.key}
            type="button"
            title={opt.label}
            onClick={() => setColor(opt.key)}
            className={`size-5 shrink-0 cursor-pointer rounded-full ${opt.swatch} ${
              color === opt.key ? "ring-2 ring-foreground ring-offset-1 ring-offset-background" : ""
            }`}
          />
        ))}
      </div>
      <button type="submit" className="btn-dark shrink-0 px-3 py-1 text-xs">
        Crear
      </button>
      <button type="button" onClick={onCancel} className="shrink-0 cursor-pointer text-xs text-muted-foreground hover:text-foreground">
        Cancelar
      </button>
    </form>
  );
}
