import { CustomFieldType, CustomFieldValue } from "../types";

// Un único input compacto para editar el valor de UNA columna personalizada, según su tipo — se
// usa tanto en el Planificador (PlannerField, valores en Task.customFields) como en el kanban de
// páginas personalizadas (CustomFieldDef, valores en KanbanCard.fields): ambos comparten el mismo
// `CustomFieldType`, así que basta con `type`/`options`/`value`/`onChange` sueltos en vez de dos
// componentes casi idénticos.
export function CustomFieldInput({
  type,
  options,
  value,
  onChange,
  autoFocus,
}: {
  type: CustomFieldType;
  options?: string[];
  value: CustomFieldValue;
  onChange: (value: CustomFieldValue) => void;
  autoFocus?: boolean;
}) {
  if (type === "number") {
    return (
      <input
        autoFocus={autoFocus}
        type="number"
        value={value === null || value === undefined ? "" : value}
        onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
        className="field-input w-full text-xs"
      />
    );
  }

  if (type === "date") {
    return (
      <input
        autoFocus={autoFocus}
        type="date"
        value={typeof value === "string" ? value.slice(0, 10) : ""}
        onChange={(e) => onChange(e.target.value || null)}
        className="field-input w-full text-xs"
      />
    );
  }

  if (type === "select") {
    return (
      <select
        autoFocus={autoFocus}
        value={value === null || value === undefined ? "" : String(value)}
        onChange={(e) => onChange(e.target.value || null)}
        className="field-input w-full text-xs"
      >
        <option value="">Sin elegir</option>
        {(options ?? []).map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    );
  }

  return (
    <input
      autoFocus={autoFocus}
      type="text"
      value={value === null || value === undefined ? "" : String(value)}
      onChange={(e) => onChange(e.target.value === "" ? null : e.target.value)}
      className="field-input w-full text-xs"
    />
  );
}

// Cómo se ve el valor cuando NO se está editando (disparador de la celda, badge en la tarjeta...).
export function formatCustomFieldValue(type: CustomFieldType, value: CustomFieldValue): string {
  if (value === null || value === undefined || value === "") return "—";
  if (type === "date" && typeof value === "string") {
    return new Date(value).toLocaleDateString("es-ES", { day: "2-digit", month: "short" });
  }
  return String(value);
}
