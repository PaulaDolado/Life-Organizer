export const DEFAULT_TIMEZONE = "Europe/Madrid"; // debe coincidir con el @default del schema (User.timezone)

/** Valida que `tz` sea una zona IANA reconocida por el motor (Node 20+ soporta Intl.supportedValuesOf). */
export function isValidTimezone(tz: string): boolean {
  try {
    // eslint-disable-next-line no-new
    new Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** Devuelve `tz` si es válida, o el default si no lo es (nunca deja que un timezone corrupto tumbe un cálculo de fechas). */
export function safeTimezone(tz: string | null | undefined): string {
  return tz && isValidTimezone(tz) ? tz : DEFAULT_TIMEZONE;
}
