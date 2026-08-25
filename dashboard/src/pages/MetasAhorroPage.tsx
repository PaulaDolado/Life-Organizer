import { useState } from "react";
import { PageHeader } from "../components/AppShell";
import { api } from "../api/client";
import { useFetch } from "../hooks/useFetch";
import { Loading, ErrorMessage, EmptyState } from "../components/Feedback";
import { SavingsGoalCard, NewSavingsGoalForm, SAVINGS_GOAL_TYPES, SAVINGS_GOAL_TYPE_LABELS } from "../components/SavingsGoals";
import { SavingsGoal } from "../types";

type FilterTab = "all" | SavingsGoal["type"];
const TABS: { value: FilterTab; label: string }[] = [
  { value: "all", label: "Todas" },
  ...SAVINGS_GOAL_TYPES.map((t) => ({ value: t, label: SAVINGS_GOAL_TYPE_LABELS[t] })),
];

export function MetasAhorroPage() {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<FilterTab>("all");
  const { data, loading, error, reload } = useFetch(
    () => api.get<{ savingsGoals: SavingsGoal[] }>(`/finance/savings-goals${tab === "all" ? "" : `?type=${tab}`}`),
    [tab]
  );

  return (
    <>
      <PageHeader
        title="Metas de ahorro e inversión"
        subtitle="Cada casilla representa un tramo fijo de dinero — haz clic para asignarlo"
        action={
          <button onClick={() => setOpen((v) => !v)} className="btn-dark">
            {open ? "Cerrar" : "+ Nueva meta"}
          </button>
        }
      />

      {open && (
        <NewSavingsGoalForm
          defaultType={tab === "all" ? "ahorro" : tab}
          onSubmit={async (input) => {
            await api.post("/finance/savings-goals", input);
            setOpen(false);
            reload();
          }}
        />
      )}

      <div className="mb-8 flex gap-2">
        {TABS.map((t) => (
          <button
            key={t.value}
            onClick={() => setTab(t.value)}
            className={`cursor-pointer rounded-full px-4 py-2 text-sm transition-colors ${
              tab === t.value ? "bg-primary text-primary-foreground" : "border border-border text-muted-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && <ErrorMessage message={error} />}
      {loading && !data ? (
        // Solo en la carga inicial: en un `reload()` (p.ej. tras pisar una casilla), mantener la
        // rejilla montada evita perder el estado local de cada tarjeta — el modal de "ver todas
        // las casillas" se cerraba solo en cada clic porque este `<Loading>` desmontaba la tarjeta.
        <Loading label="Cargando metas de ahorro..." />
      ) : (data?.savingsGoals.length ?? 0) === 0 ? (
        <EmptyState message="Todavía no tienes metas en esta categoría. Crea la primera arriba." />
      ) : (
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {data?.savingsGoals.map((goal) => (
            <SavingsGoalCard key={goal.id} goal={goal} onChanged={reload} />
          ))}
        </div>
      )}
    </>
  );
}
