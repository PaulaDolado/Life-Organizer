// Estilo visual de las tarjetas de la Galería que todavía no tienen foto ("colores neutros del
// estilo de la web, traslúcidos" — ver GalleryTemplate en CustomPagePage): reutiliza los propios
// tokens de tema de la app (ver styles.css) en vez de un gris genérico, para que encajen con el
// resto de la interfaz. Y la altura variable de cada marco es lo que da el efecto "pared de
// fotos" de la referencia de diseño — dentro de un `columns-4`, tarjetas de alturas distintas
// hacen que las columnas se escalonen solas, sin tener que posicionar nada a mano.
const PLACEHOLDER_COLORS = [
  "bg-primary/10",
  "bg-hobby/15",
  "bg-warning/10",
  "bg-positive/10",
  "bg-habit/10",
  "bg-secondary/50",
  "bg-cover/10",
];

const FRAME_HEIGHTS = ["h-40", "h-64", "h-52", "h-72", "h-44", "h-60", "h-48", "h-56"];

// Hash simple y determinista — mismo criterio que colorForCustomLink en quickAccessApps.ts: por
// id (no por posición en la lista), para que el aspecto de una tarjeta no cambie cada vez que se
// añade o se borra otra. `id` es el uuid generado en el cliente de GalleryEntry (ver newId), no
// un id de fila — la Galería vive dentro de CustomPage.content, no en su propia tabla.
function hashString(s: string): number {
  let hash = 0;
  for (let i = 0; i < s.length; i++) hash = (hash * 31 + s.charCodeAt(i)) >>> 0;
  return hash;
}

export function placeholderColorFor(id: string): string {
  return PLACEHOLDER_COLORS[hashString(`${id}-color`) % PLACEHOLDER_COLORS.length];
}

// Offset distinto del mismo id (sufijo "-height" en vez de "-color") para que el color y la
// altura no varíen siempre a la vez — más variedad visual en la pared.
export function frameHeightFor(id: string): string {
  return FRAME_HEIGHTS[hashString(`${id}-height`) % FRAME_HEIGHTS.length];
}
