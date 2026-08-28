import { useEffect, useState } from "react";
import { PageHeader } from "../components/AppShell";
import { api, ApiError } from "../api/client";
import { useFetch } from "../hooks/useFetch";
import { Loading, ErrorMessage } from "../components/Feedback";
import { ScheduleRow } from "../types";

type DayKey = "monday" | "tuesday" | "wednesday" | "thursday" | "friday";
const DAYS: { key: DayKey; label: string }[] = [
  { key: "monday", label: "Lunes" },
  { key: "tuesday", label: "Martes" },
  { key: "wednesday", label: "Miércoles" },
  { key: "thursday", label: "Jueves" },
  { key: "friday", label: "Viernes" },
];

// Horario semanal fijo de texto libre (típicamente de universidad): una tabla lunes-viernes
// donde cada celda es una franja horaria en blanco para que el usuario escriba lo que quiera
// (asignatura, aula...) — sin fechas ni estructura forzada, a diferencia de los eventos de
// Agenda. El backend (ver API.md > Horario) guarda cada fila con `order` para poder
// reordenarlas, y cada celda es una columna de texto suelta (monday/tuesday/...).
export function SchedulePage() {
  const { data, loading, error, reload } = useFetch(() => api.get<{ rows: ScheduleRow[] }>("/schedule"), []);
  const [rows, setRows] = useState<ScheduleRow[]>([]);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<number | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Copia local editable — igual que el patrón ya usado en RichTextEditor/ProyectosPage: se
  // sincroniza desde el fetch, pero mientras el usuario escribe, el estado local manda (no se
  // pisa con cada re-render) y el guardado real ocurre al perder el foco de la celda.
  useEffect(() => {
    if (data) setRows(data.rows);
  }, [data]);

  const updateLocal = (id: number, patch: Partial<ScheduleRow>) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  const persist = async (id: number, patch: Record<string, string>) => {
    try {
      await api.put(`/schedule/${id}`, patch);
      setSaveError(null);
    } catch (err) {
      setSaveError(err instanceof ApiError ? err.message : "No se pudo guardar el cambio.");
    }
  };

  const addRow = async () => {
    await api.post("/schedule", {});
    reload();
  };

  const removeRow = async (id: number) => {
    await api.delete(`/schedule/${id}`);
    setConfirmingDeleteId(null);
    reload();
  };

  // Igual que en Proyectos/Apuntes rápidos: primer click pide confirmación, segundo click (en
  // el mismo botón) borra de verdad; alejar el ratón cancela la confirmación pendiente.
  const handleDeleteClick = (id: number) => {
    if (confirmingDeleteId === id) removeRow(id);
    else setConfirmingDeleteId(id);
  };

  const move = async (id: number, direction: "up" | "down") => {
    await api.put(`/schedule/${id}/move`, { direction });
    reload();
  };

  return (
    <>
      <PageHeader title="Horario" subtitle="Tu horario semanal fijo — universidad, clases, lo que sea" />

      {error && <ErrorMessage message={error} />}
      {saveError && <ErrorMessage message={saveError} />}

      {loading ? (
        <Loading label="Cargando horario..." />
      ) : (
        <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-[var(--shadow-soft)]">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-left text-xs font-medium uppercase tracking-widest text-muted-foreground">
                  <th className="w-36 px-3 py-3">Hora</th>
                  {DAYS.map((d) => (
                    <th key={d.key} className="px-3 py-3">
                      {d.label}
                    </th>
                  ))}
                  <th className="w-20 px-3 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((row, i) => (
                  <tr key={row.id} className="group">
                    <td className="border-r border-border p-0 align-top">
                      <input
                        value={row.timeLabel}
                        onChange={(e) => updateLocal(row.id, { timeLabel: e.target.value })}
                        onBlur={(e) => persist(row.id, { timeLabel: e.target.value })}
                        placeholder="08:00 - 10:00"
                        className="w-full rounded-none bg-transparent px-3 py-2.5 text-xs font-medium text-muted-foreground outline-none focus:bg-muted/40"
                      />
                    </td>
                    {DAYS.map((d) => (
                      <td key={d.key} className="border-r border-border p-0 align-top last-of-type:border-r-0">
                        <input
                          value={row[d.key]}
                          onChange={(e) => updateLocal(row.id, { [d.key]: e.target.value } as Partial<ScheduleRow>)}
                          onBlur={(e) => persist(row.id, { [d.key]: e.target.value })}
                          placeholder="—"
                          className="w-full bg-transparent px-3 py-2.5 text-sm outline-none placeholder:text-muted-foreground/40 focus:bg-muted/40"
                        />
                      </td>
                    ))}
                    <td className="p-0 text-center align-middle">
                      <div className="flex items-center justify-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                        <button
                          type="button"
                          onClick={() => move(row.id, "up")}
                          disabled={i === 0}
                          title="Subir"
                          className="cursor-pointer rounded px-1.5 py-1 text-xs text-muted-foreground hover:text-foreground disabled:cursor-not-allowed disabled:opacity-30"
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          onClick={() => move(row.id, "down")}
                          disabled={i === rows.length - 1}
                          title="Bajar"
                          className="cursor-pointer rounded px-1.5 py-1 text-xs text-muted-foreground hover:text-foreground disabled:cursor-not-allowed disabled:opacity-30"
                        >
                          ↓
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteClick(row.id)}
                          onMouseLeave={() => setConfirmingDeleteId((id) => (id === row.id ? null : id))}
                          title={confirmingDeleteId === row.id ? "Confirmar eliminar" : "Eliminar franja"}
                          className={`cursor-pointer rounded px-1.5 py-1 text-xs ${
                            confirmingDeleteId === row.id ? "font-bold text-destructive opacity-100" : "text-muted-foreground hover:text-destructive"
                          }`}
                        >
                          ✕
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-3 py-10 text-center text-sm text-muted-foreground">
                      Todavía no tienes ninguna franja horaria. Añade la primera abajo.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <button
            onClick={addRow}
            className="w-full cursor-pointer border-t border-border px-3 py-3 text-left text-xs text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
          >
            + Añadir franja horaria
          </button>
        </div>
      )}
    </>
  );
}
