import { useState } from "react";
import { api } from "../api/client";
import { SavingsGoal } from "../types";

// Compartido entre MetasAhorroPage (vista dedicada) y FinanzasPage (resumen + alta rápida),
// para que "ahorro" e "inversión" se gestionen y se vean exactamente igual en los dos sitios.

// Vista previa dentro de la galería: cuando la meta tiene más casillas que esto, se recorta y
// se ofrece un "Ver las N casillas →" que abre el modal con todas, sin el corte de la rejilla.
const PREVIEW_BOXES = 30;
// Tope de seguridad real (solo evita reventar el layout con un objetivo/paso absurdos, p.ej.
// 1.000.000€ a 1€ la casilla) — no es una limitación de uso normal.
const MAX_TOTAL_BOXES = 2000;

export const SAVINGS_GOAL_TYPES: SavingsGoal["type"][] = ["ahorro", "inversion"];
export const SAVINGS_GOAL_TYPE_LABELS: Record<SavingsGoal["type"], string> = {
  ahorro: "Ahorro",
  inversion: "Inversión",
};

export function eur(n: number): string {
  return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
}

// Etiqueta corta para el interior de cada casilla: importe acumulado hasta esa casilla,
// abreviado en miles como en una hoja de ahorro en papel (100€, 1k€, 1,1k€... 15,9k€).
function boxLabel(amount: number): string {
  if (amount < 1000) return `${Math.round(amount)}€`;
  const thousands = Math.round((amount / 1000) * 10) / 10;
  const text = Number.isInteger(thousands) ? `${thousands}` : thousands.toFixed(1).replace(".", ",");
  return `${text}k€`;
}

const GOAL_ICON: Record<SavingsGoal["type"], string> = { ahorro: "💰", inversion: "📈" };

function BoxesGrid({
  count,
  filled,
  step,
  onBoxClick,
}: {
  count: number;
  filled: number;
  step: number;
  onBoxClick: (i: number) => void;
}) {
  return (
    <div className="grid grid-cols-10 gap-1.5">
      {Array.from({ length: count }, (_, i) => {
        const isFilled = i < filled;
        const isMilestone = (i + 1) % 10 === 0;
        return (
          <button
            key={i}
            type="button"
            aria-label={`Casilla ${i + 1}: ${boxLabel((i + 1) * step)}${isFilled ? " (conseguida)" : ""}`}
            title={eur((i + 1) * step)}
            onClick={() => onBoxClick(i)}
            className={`flex aspect-[6/5] cursor-pointer items-center justify-center rounded-lg border text-[9px] leading-none transition-colors sm:text-[10px] ${
              isFilled
                ? "border-primary bg-primary text-primary-foreground line-through decoration-primary-foreground/70"
                : isMilestone
                  ? "border-primary/40 bg-primary/15 font-bold text-foreground hover:bg-primary/25"
                  : "border-border bg-muted/60 text-muted-foreground hover:bg-primary/10"
            }`}
          >
            {boxLabel((i + 1) * step)}
          </button>
        );
      })}
    </div>
  );
}

export function SavingsGoalCard({ goal, onChanged }: { goal: SavingsGoal; onChanged: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const step = goal.stepAmount > 0 ? goal.stepAmount : 100;
  const boxCount = Math.min(MAX_TOTAL_BOXES, Math.max(1, Math.ceil(goal.targetAmount / step)));
  const filled = Math.min(boxCount, Math.round(goal.currentAmount / step));
  const isTruncated = boxCount > PREVIEW_BOXES;

  const handleBoxClick = async (i: number) => {
    // Estilo "rating de estrellas": clicar una casilla rellena hasta ahí; volver a clicar la
    // última rellenada la vacía (permite corregir un clic de más sin tener que hacer cuentas).
    const newFilled = i + 1 === filled ? i : i + 1;
    const delta = (newFilled - filled) * step;
    if (delta === 0) return;
    await api.post(`/finance/savings-goals/${goal.id}/contribute`, { amount: delta });
    onChanged();
  };

  const remove = async () => {
    await api.delete(`/finance/savings-goals/${goal.id}`);
    onChanged();
  };

  return (
    <div className="card-soft">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <p className="font-serif text-xl">
          <span aria-hidden>{GOAL_ICON[goal.type]}</span> {SAVINGS_GOAL_TYPE_LABELS[goal.type]} · {goal.name}
        </p>
        <div className="flex items-center gap-3">
          <span className="whitespace-nowrap rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground">
            Objetivo: {eur(goal.targetAmount)}
          </span>
          <button onClick={remove} className="cursor-pointer whitespace-nowrap text-xs text-muted-foreground hover:text-destructive">
            Eliminar
          </button>
        </div>
      </div>

      <BoxesGrid count={isTruncated ? PREVIEW_BOXES : boxCount} filled={filled} step={step} onBoxClick={handleBoxClick} />

      {isTruncated && (
        <button
          onClick={() => setExpanded(true)}
          className="mt-3 cursor-pointer text-xs font-medium text-primary hover:underline"
        >
          Ver las {boxCount} casillas →
        </button>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>
          Casillas: <strong className="text-foreground">{boxCount}</strong> · {eur(step)} cada una · categoría {goal.category}
        </span>
        <span>
          Ahorrado hasta ahora: <strong className="text-foreground">{eur(goal.currentAmount)}</strong> / {eur(goal.targetAmount)} (
          {goal.progressPercent}%)
        </span>
      </div>

      {expanded && (
        <SavingsGoalBoxesModal
          goal={goal}
          boxCount={boxCount}
          filled={filled}
          step={step}
          onBoxClick={handleBoxClick}
          onClose={() => setExpanded(false)}
        />
      )}
    </div>
  );
}

// Vista de todas las casillas de una meta, a pantalla completa — así una meta con un objetivo
// alto (muchas más de las que caben en la vista previa de la galería) se puede ver entera, con
// scroll propio, sin quedar cortada por el ancho de columna de la galería.
function SavingsGoalBoxesModal({
  goal,
  boxCount,
  filled,
  step,
  onBoxClick,
  onClose,
}: {
  goal: SavingsGoal;
  boxCount: number;
  filled: number;
  step: number;
  onBoxClick: (i: number) => void;
  onClose: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/50 p-4 sm:p-8"
      onClick={onClose}
    >
      <div
        className="max-h-full w-full max-w-4xl overflow-y-auto rounded-3xl bg-card p-6 shadow-[var(--shadow-soft)] sm:p-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <p className="font-serif text-xl">
            <span aria-hidden>{GOAL_ICON[goal.type]}</span> {SAVINGS_GOAL_TYPE_LABELS[goal.type]} · {goal.name}
          </p>
          <div className="flex items-center gap-3">
            <span className="whitespace-nowrap rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground">
              Objetivo: {eur(goal.targetAmount)}
            </span>
            <button onClick={onClose} className="cursor-pointer whitespace-nowrap text-xs text-muted-foreground hover:text-foreground">
              ✕ Cerrar
            </button>
          </div>
        </div>

        <BoxesGrid count={boxCount} filled={filled} step={step} onBoxClick={onBoxClick} />

        <p className="mt-4 text-xs text-muted-foreground">
          Casillas: <strong className="text-foreground">{boxCount}</strong> · {eur(step)} cada una · Ahorrado hasta ahora:{" "}
          <strong className="text-foreground">{eur(goal.currentAmount)}</strong> / {eur(goal.targetAmount)} ({goal.progressPercent}%)
        </p>
      </div>
    </div>
  );
}

export interface NewSavingsGoalInput {
  name: string;
  type: SavingsGoal["type"];
  targetAmount: number;
  category: string;
  stepAmount: number;
}

// La categoría (usada internamente para filtrar qué transacciones cuentan hacia la meta, ver
// financeService.computeSavingsProgress) se deriva del nombre y el tipo — no se le pide al
// usuario, para no añadir un campo más que rellenar por algo que es un detalle interno.
function slugify(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // quita los acentos que separó el normalize NFD
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function NewSavingsGoalForm({
  defaultType = "ahorro",
  onSubmit,
}: {
  defaultType?: SavingsGoal["type"];
  onSubmit: (input: NewSavingsGoalInput) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [type, setType] = useState<SavingsGoal["type"]>(defaultType);
  const [targetAmount, setTargetAmount] = useState("");
  const [stepAmount, setStepAmount] = useState("100");
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setError(null);
        const target = Number(targetAmount);
        const step = Number(stepAmount);
        if (!name.trim()) return setError("Ponle un nombre a la meta.");
        if (!target) return setError("El objetivo total tiene que ser mayor que 0.");
        if (!step) return setError("El importe por casilla tiene que ser mayor que 0.");

        const category = `${type}-${slugify(name)}`;
        await onSubmit({ name: name.trim(), type, targetAmount: target, stepAmount: step, category });
        setName("");
        setTargetAmount("");
        setStepAmount("100");
      }}
      className="mb-10 grid gap-4 rounded-3xl border border-secondary bg-secondary/30 p-6 md:grid-cols-2"
    >
      <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground md:col-span-2">Nueva meta</p>

      <div className="flex gap-2 md:col-span-2">
        {SAVINGS_GOAL_TYPES.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setType(t)}
            className={`cursor-pointer rounded-full px-4 py-1.5 text-xs transition-colors ${
              type === t ? "bg-primary text-primary-foreground" : "border border-border text-muted-foreground"
            }`}
          >
            {SAVINGS_GOAL_TYPE_LABELS[t]}
          </button>
        ))}
      </div>

      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre de la meta" className="field-input md:col-span-2" />
      <input value={targetAmount} onChange={(e) => setTargetAmount(e.target.value)} type="number" min="0" placeholder="Objetivo total €" className="field-input" />
      <label className="flex flex-col gap-1 text-xs text-muted-foreground">
        Importe por casilla (€) — lo que asigna cada clic
        <input
          value={stepAmount}
          onChange={(e) => setStepAmount(e.target.value)}
          type="number"
          min="1"
          className="field-input"
        />
      </label>
      <p className="text-[10px] text-muted-foreground md:col-span-2">
        Cada clic en una casilla asigna (o retira) ese importe fijo a la meta — se registra como un movimiento real.
      </p>
      {error && <p className="text-xs text-destructive md:col-span-2">{error}</p>}
      <button type="submit" className="btn-dark md:col-span-2 md:justify-self-start">
        Crear meta
      </button>
    </form>
  );
}
