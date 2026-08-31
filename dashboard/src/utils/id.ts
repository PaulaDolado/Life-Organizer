// Id local para elementos que viven dentro de un JSON (tarjetas de kanban, ítems de checklist...)
// en vez de ser su propia fila en la base de datos — ver CustomPage.content. `crypto.randomUUID`
// no existe en contextos no seguros (http sin TLS) en navegadores antiguos, de ahí el fallback.
export function newId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
