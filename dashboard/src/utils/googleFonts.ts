// Tipografías disponibles en el selector del editor de páginas. Lista curada a propósito (no
// "todo Google Fonts") para no disparar una petición de red por cada fuente rara vez usada:
// solo se carga el stylesheet de una fuente cuando el usuario la usa de verdad (ver
// loadGoogleFont), pero al exportar a PDF/Word sí se listan todas — ese documento vive fuera
// de esta sesión, así que necesita poder pedir cualquiera que el contenido use.
export const GOOGLE_FONTS = [
  "Inter",
  "Roboto",
  "Playfair Display",
  "Merriweather",
  "Lora",
  "Poppins",
  "Space Mono",
  "Caveat",
] as const;

export type GoogleFont = (typeof GOOGLE_FONTS)[number];

const loadedFonts = new Set<string>();

/** Inyecta el <link> de Google Fonts para esa familia si aún no está cargado en esta página. */
export function loadGoogleFont(family: string): void {
  if (!GOOGLE_FONTS.includes(family as GoogleFont) || loadedFonts.has(family)) return;
  loadedFonts.add(family);
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = googleFontsStylesheetUrl(family);
  link.setAttribute("data-google-font", family);
  document.head.appendChild(link);
}

export function googleFontsStylesheetUrl(family: string): string {
  return `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@400;600;700&display=swap`;
}

/** <link> de todas las tipografías del selector, para documentos exportados (PDF/Word) que
 * viven fuera de esta página y no pasan por loadGoogleFont(). */
export function allGoogleFontsLinkTags(): string {
  return GOOGLE_FONTS.map((f) => `<link rel="stylesheet" href="${googleFontsStylesheetUrl(f)}" />`).join("\n");
}
