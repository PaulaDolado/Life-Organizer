import { useState } from "react";
import { PageHeader } from "../components/AppShell";
import { api } from "../api/client";
import { useFetch } from "../hooks/useFetch";
import { Loading, ErrorMessage } from "../components/Feedback";
import { MiniLineChart } from "../components/MiniLineChart";
import { FinanceAnalytics, MonthlyBalance, Pagination, SavingsGoal, Transaction } from "../types";

const MONTH_LABELS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

function eur(n: number): string {
  return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
}

export function FinanzasPage() {
  const now = new Date();
  const {
    data: balance,
    loading: loadingBalance,
    error: balanceError,
    reload: reloadBalance,
  } = useFetch(() => api.get<MonthlyBalance>(`/finance/balance/${now.getMonth() + 1}/${now.getFullYear()}`), []);
  const {
    data: txData,
    loading: loadingTx,
    error: txError,
    reload: reloadTx,
  } = useFetch(() => api.get<{ transactions: Transaction[]; pagination: Pagination }>("/finance/transactions?limit=15"), []);
  const { data: analytics, reload: reloadAnalytics } = useFetch(() => api.get<FinanceAnalytics>("/finance/analytics"), []);
  // Solo para los totales de las tarjetas resumen (Ahorro/Inversión) — las metas en sí (crear,
  // ver casillas, eliminar) viven únicamente en "Metas de ahorro", no se duplican aquí.
  const { data: savingsData, reload: reloadSavings } = useFetch(
    () => api.get<{ savingsGoals: SavingsGoal[] }>("/finance/savings-goals"),
    []
  );

  const reloadAll = () => {
    reloadBalance();
    reloadTx();
    reloadAnalytics();
    reloadSavings();
  };

  const savingsGoals = savingsData?.savingsGoals ?? [];
  const totalAhorro = savingsGoals.filter((g) => g.type === "ahorro").reduce((sum, g) => sum + g.currentAmount, 0);
  const totalInversion = savingsGoals.filter((g) => g.type === "inversion").reduce((sum, g) => sum + g.currentAmount, 0);

  return (
    <>
      <PageHeader title="Finanzas" subtitle="Ingresos, gastos, balance, ahorro e inversión" />

      <div className="grid gap-8 lg:grid-cols-12">
        <div className="space-y-8 lg:col-span-8">
          {balanceError && <ErrorMessage message={balanceError} />}
          {loadingBalance ? (
            <Loading label="Cargando balance..." />
          ) : (
            <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-5">
              <SummaryCard label="Ingresos" value={eur(balance?.income ?? 0)} tone="positive" />
              <SummaryCard label="Gastos" value={eur(balance?.expense ?? 0)} tone="negative" />
              <SummaryCard label="Balance" value={eur(balance?.balance ?? 0)} tone={(balance?.balance ?? 0) >= 0 ? "positive" : "negative"} />
              <SummaryCard label="Ahorro" value={eur(totalAhorro)} tone="positive" />
              <SummaryCard label="Inversión" value={eur(totalInversion)} tone="positive" />
            </div>
          )}

          <NewMovementForm
            onSubmit={async (input) => {
              await api.post("/finance/transactions", input);
              reloadAll();
            }}
          />

          <div>
            <h2 className="mb-6 text-xl font-medium">Movimientos</h2>
            {txError && <ErrorMessage message={txError} />}
            <div className="overflow-hidden rounded-3xl border border-border bg-card">
              {loadingTx ? (
                <Loading />
              ) : (txData?.transactions.length ?? 0) === 0 ? (
                <p className="p-8 text-center text-sm text-muted-foreground">Sin movimientos todavía.</p>
              ) : (
                txData?.transactions.map((tx) => (
                  <div key={tx.id} className="group flex items-center justify-between border-b border-border px-6 py-4 last:border-b-0">
                    <div>
                      <p className="font-medium">{tx.description || tx.category}</p>
                      <span className="text-xs uppercase tracking-wider text-muted-foreground">
                        {tx.category} · {new Date(tx.date).toLocaleDateString("es-ES")}
                      </span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className={`font-medium ${tx.type === "expense" ? "text-destructive" : "text-primary"}`}>
                        {tx.type === "expense" ? "−" : "+"}
                        {eur(tx.amount)}
                      </span>
                      <button
                        onClick={async () => {
                          await api.delete(`/finance/transactions/${tx.id}`);
                          reloadAll();
                        }}
                        className="cursor-pointer text-xs text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                      >
                        Eliminar
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {analytics && (
            <div className="space-y-6">
              <div className="card-soft">
                <h2 className="mb-4 text-sm font-medium">Tendencia (últimos 6 meses)</h2>
                <MiniLineChart
                  data={analytics.monthlyTrend.map((m) => ({ label: MONTH_LABELS[m.month - 1], value: m.balance }))}
                  formatValue={eur}
                />
              </div>
            </div>
          )}
        </div>

        <div className="space-y-6 lg:col-span-4">
          <div className="rounded-3xl bg-primary p-8 text-primary-foreground">
            <h2 className="mb-6 text-xs uppercase tracking-widest opacity-60">Resumen del mes</h2>
            <div className="space-y-4">
              <Row label="Ingresos" value={`+${eur(balance?.income ?? 0)}`} />
              <Row label="Gastos" value={`−${eur(balance?.expense ?? 0)}`} />
              <div className="my-2 h-px bg-primary-foreground/20" />
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold">Saldo neto</span>
                <span className="font-serif text-xl">{eur(balance?.balance ?? 0)}</span>
              </div>
            </div>
          </div>

          {analytics && (
            <div className="rounded-3xl bg-secondary p-6 text-secondary-foreground">
              <h2 className="mb-4 text-sm font-medium">Top 5 categorías de gasto (este mes)</h2>
              {analytics.topCategories.length === 0 ? (
                <p className="text-sm opacity-70">Sin gastos registrados este mes.</p>
              ) : (
                <ul className="space-y-2">
                  {analytics.topCategories.map((c) => (
                    <li key={c.category} className="flex items-center justify-between border-b border-secondary-foreground/15 pb-2 text-sm last:border-b-0">
                      <span>{c.category}</span>
                      <strong>{eur(c.total)}</strong>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {analytics && (
            <div className="card-soft">
              <h2 className="mb-2 text-sm font-medium">Proyección anual</h2>
              <p className="text-sm text-muted-foreground">
                Al ritmo de los últimos {analytics.projectedAnnual.basedOnMonths} meses ({eur(analytics.projectedAnnual.avgMonthlyBalance)}/mes en
                promedio), terminarías el año con{" "}
                <strong className="text-foreground">{eur(analytics.projectedAnnual.projectedYearEnd)}</strong> acumulados.
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm opacity-80">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

function SummaryCard({ label, value, tone }: { label: string; value: string; tone: "positive" | "negative" }) {
  return (
    <div className="card-soft">
      <p className="text-xs uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className={`mt-2 font-serif text-3xl ${tone === "negative" ? "text-destructive" : "text-primary"}`}>{value}</p>
    </div>
  );
}

interface NewMovementInput {
  type: "income" | "expense";
  amount: number;
  category: string;
  description: string;
}

function NewMovementForm({ onSubmit }: { onSubmit: (input: NewMovementInput) => Promise<void> }) {
  const [concept, setConcept] = useState("");
  const [amount, setAmount] = useState("");
  const [kind, setKind] = useState<"ingreso" | "gasto">("gasto");
  const [category, setCategory] = useState("general");

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        const value = Number(amount);
        if (!concept.trim() || !value) return;

        await onSubmit({
          type: kind === "gasto" ? "expense" : "income",
          amount: value,
          category: category.trim() || "general",
          description: concept.trim(),
        });
        setConcept("");
        setAmount("");
      }}
      className="grid gap-4 card-soft md:grid-cols-[2fr_1fr_1fr_1fr_auto]"
    >
      <input value={concept} onChange={(e) => setConcept(e.target.value)} placeholder="Concepto" className="field-input" />
      <input value={amount} onChange={(e) => setAmount(e.target.value)} type="number" min="0" step="0.01" placeholder="Importe" className="field-input" />
      <select value={kind} onChange={(e) => setKind(e.target.value as typeof kind)} className="field-input">
        <option value="gasto">Gasto</option>
        <option value="ingreso">Ingreso</option>
      </select>
      <input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Categoría" className="field-input" />
      <button type="submit" className="btn-dark">
        Registrar
      </button>
    </form>
  );
}
