import { api } from "../api/client";
import { useFetch } from "../hooks/useFetch";
import { FinanceAnalytics, MonthlyBalance } from "../types";
import { Loading, ErrorMessage } from "./Feedback";
import { MiniBarChart } from "./MiniBarChart";

const MONTH_LABELS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(value);
}

export function FinanceSummary() {
  const now = new Date();
  const { data: balance, loading: loadingBalance, error: balanceError } = useFetch(
    () => api.get<MonthlyBalance>(`/finance/balance/${now.getMonth() + 1}/${now.getFullYear()}`),
    []
  );
  const { data: analytics, loading: loadingAnalytics, error: analyticsError } = useFetch(
    () => api.get<FinanceAnalytics>("/finance/analytics"),
    []
  );

  if (loadingBalance || loadingAnalytics) return <Loading label="Cargando finanzas..." />;
  if (balanceError) return <ErrorMessage message={balanceError} />;
  if (analyticsError) return <ErrorMessage message={analyticsError} />;

  return (
    <div>
      <div className="stat-row">
        <div className="stat-tile">
          <span className="stat-tile__label">Ingresos este mes</span>
          <span className="stat-tile__value stat-tile__value--positive">{formatCurrency(balance?.income ?? 0)}</span>
        </div>
        <div className="stat-tile">
          <span className="stat-tile__label">Gastos este mes</span>
          <span className="stat-tile__value stat-tile__value--negative">{formatCurrency(balance?.expense ?? 0)}</span>
        </div>
        <div className="stat-tile">
          <span className="stat-tile__label">Balance</span>
          <span className={`stat-tile__value ${(balance?.balance ?? 0) >= 0 ? "stat-tile__value--positive" : "stat-tile__value--negative"}`}>
            {formatCurrency(balance?.balance ?? 0)}
          </span>
        </div>
      </div>

      {analytics && (
        <>
          <section className="panel">
            <h3>Tendencia (últimos 6 meses)</h3>
            <MiniBarChart
              data={analytics.monthlyTrend.map((m) => ({
                label: MONTH_LABELS[m.month - 1],
                value: m.balance,
              }))}
            />
          </section>

          <section className="panel">
            <h3>Top 5 categorías de gasto (este mes)</h3>
            {analytics.topCategories.length === 0 ? (
              <p className="feedback feedback--empty">Sin gastos registrados este mes.</p>
            ) : (
              <ul className="category-list">
                {analytics.topCategories.map((c) => (
                  <li key={c.category}>
                    <span>{c.category}</span>
                    <strong>{formatCurrency(c.total)}</strong>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="panel">
            <h3>Proyección anual</h3>
            <p>
              Si mantienes el ritmo de los últimos {analytics.projectedAnnual.basedOnMonths} meses (
              {formatCurrency(analytics.projectedAnnual.avgMonthlyBalance)}/mes en promedio), terminarías el año con un
              balance acumulado de <strong>{formatCurrency(analytics.projectedAnnual.projectedYearEnd)}</strong>.
            </p>
          </section>
        </>
      )}
    </div>
  );
}
