// Conversión HTML ↔ texto plano — no hay ninguna librería de editor de texto enriquecido en el
// móvil (ver el comentario de cabecera de ProyectoDetailScreen.tsx: "traer una solo para esto es
// demasiado para lo que se pidió"), así que cualquier contenido guardado como HTML por el editor
// de la web (RichTextEditor.tsx) se lee/escribe aquí como texto plano en un <TextInput multiline>.
// Compartido entre las páginas de proyecto (ProyectoDetailScreen.tsx) y la plantilla "Nota en
// blanco" de página personalizada (PaginaDetailScreen.tsx) — mismo formato de contenido (`{ html
// }` o `page.content` como string HTML suelto) en ambos casos.

// Cambia las etiquetas de bloque más comunes por saltos de línea ANTES de tirar el resto de
// etiquetas, para no aplastar varios párrafos/líneas de lista en una sola frase corrida. Pierde
// negrita/cursiva/imágenes — es una lectura fiel del texto, no una vista previa fiel del formato.
export function htmlToPlainText(html: string): string {
  if (!html) return "";
  return html
    .replace(/<(p|div|li|br|h[1-6])[^>]*>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6])>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// Camino inverso: cada línea se envuelve en <p> (escapando lo que en HTML son caracteres
// especiales) para que lo guardado desde el móvil se siga viendo razonablemente bien si luego se
// abre en la web — líneas en blanco se conservan como párrafos vacíos, igual que un editor de
// texto enriquecido normal.
export function plainTextToHtml(text: string): string {
  const escape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return text
    .split("\n")
    .map((line) => `<p>${escape(line) || "<br>"}</p>`)
    .join("");
}
