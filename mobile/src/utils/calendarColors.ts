// Puerto de dashboard/src/utils/calendarColors.ts — mismos 8 colores de la leyenda del calendario
// anual, traducidos a los tokens RGB de theme.ts (RN no tiene el `bg-x/25` de Tailwind, así que
// las mezclas alfa van escritas literales en rgba()). "primary" y "positive" son, a propósito,
// el mismo verde: ya lo son en la propia web (--positive y --sage comparten el mismo oklch en
// dashboard/src/styles.css), así que replicarlo aquí no es un fallo, es fidelidad al original.
import { colors } from "../theme";
import { CalendarColor } from "../types";

export const CALENDAR_COLOR_OPTIONS: { key: CalendarColor; label: string; swatch: string }[] = [
  { key: "primary", label: "Verde salvia", swatch: colors.primary },
  { key: "habit", label: "Azul", swatch: colors.habit },
  { key: "positive", label: "Verde", swatch: colors.positive },
  { key: "hobby", label: "Naranja", swatch: colors.hobby },
  { key: "warning", label: "Amarillo", swatch: colors.warning },
  { key: "negative", label: "Rojo", swatch: colors.destructive },
  { key: "secondary", label: "Arena", swatch: colors.secondary },
  { key: "muted", label: "Gris", swatch: "rgba(109, 104, 100, 0.5)" },
];

export const CALENDAR_COLOR_CLASSES: Record<CalendarColor, { swatch: string; cellBg: string; cellBorder: string }> = {
  primary: { swatch: colors.primary, cellBg: "rgba(95, 113, 97, 0.25)", cellBorder: "rgba(95, 113, 97, 0.5)" },
  habit: { swatch: colors.habit, cellBg: "rgba(51, 131, 173, 0.25)", cellBorder: "rgba(51, 131, 173, 0.5)" },
  positive: { swatch: colors.positive, cellBg: "rgba(95, 113, 97, 0.25)", cellBorder: "rgba(95, 113, 97, 0.5)" },
  hobby: { swatch: colors.hobby, cellBg: "rgba(251, 146, 60, 0.25)", cellBorder: "rgba(251, 146, 60, 0.5)" },
  warning: { swatch: colors.warning, cellBg: "rgba(200, 123, 0, 0.25)", cellBorder: "rgba(200, 123, 0, 0.5)" },
  negative: { swatch: colors.destructive, cellBg: "rgba(189, 67, 52, 0.2)", cellBorder: "rgba(189, 67, 52, 0.5)" },
  secondary: { swatch: colors.secondary, cellBg: "rgba(222, 208, 182, 0.7)", cellBorder: colors.secondary },
  muted: { swatch: "rgba(109, 104, 100, 0.5)", cellBg: colors.muted, cellBorder: colors.border },
};
