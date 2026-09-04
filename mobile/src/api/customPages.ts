// Cliente REST directo para "Páginas personalizadas" — mismo criterio que src/api/finance.ts,
// src/api/goals.ts y src/api/schedule.ts: CustomPage no forma parte del contrato de sync offline
// del backend (API.md lo lista explícitamente, "incluida la plantilla galería"), así que esta
// pantalla no pasa por SQLite y necesita conexión, igual que
// `dashboard/src/pages/CustomPagePage.tsx`.
import { api } from "./client";

// Mismas 8 plantillas que `CUSTOM_PAGE_TEMPLATES` en
// dashboard/src/utils/customPageTemplates.ts — el móvil tiene editor propio para "galeria",
// "nota" y "kanban" (ver PaginaDetailScreen.tsx); el resto se puede abrir (título/subtítulo
// editables) pero su contenido se edita desde la web.
export const CUSTOM_PAGE_TEMPLATES = ["nota", "kanban", "galeria", "finanzas", "proyectos", "objetivos", "agenda", "hoy"] as const;
export type CustomPageTemplate = (typeof CUSTOM_PAGE_TEMPLATES)[number];

export const TEMPLATE_LABELS: Record<CustomPageTemplate, string> = {
  nota: "Nota en blanco",
  kanban: "Kanban",
  galeria: "Galería",
  finanzas: "Finanzas",
  proyectos: "Proyectos",
  objetivos: "Objetivos",
  agenda: "Agenda",
  hoy: "Hoy",
};

export interface CustomPageSummary {
  id: number;
  title: string;
  subtitle: string | null;
  template: CustomPageTemplate;
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface GalleryEntry {
  id: string; // uuid generado en el cliente (expo-crypto), no es una fila de servidor
  title?: string;
  text?: string;
  imageData?: string | null; // data URL base64 embebida, igual que KanbanCard.image en la web
}

export interface GalleryContent {
  items: GalleryEntry[];
}

// Mismo tipo que CustomPageContentMap["nota"] en dashboard/src/types.ts — el móvil edita este
// `html` como texto plano (ver utils/htmlText.ts), no con un editor enriquecido.
export interface NotaContent {
  html: string;
}

// Propiedades personalizadas de un tablero kanban (CustomFieldDef/CustomFieldValues en
// dashboard/src/types.ts) — el móvil no tiene UI para crearlas/editarlas todavía (ver
// PaginaDetailScreen.tsx), pero se preservan tal cual al guardar para no perder las que ya se
// hubieran creado desde la web: el PUT sustituye el `content` entero (ver
// src/services/customPagesService.ts), así que cualquier campo que el móvil no toque hay que
// mantenerlo en el objeto que se manda de vuelta.
export type CustomFieldType = "text" | "number" | "date" | "select";
export interface CustomFieldDef {
  id: string;
  name: string;
  type: CustomFieldType;
  options?: string[];
}
export type CustomFieldValue = string | number | null;
export type CustomFieldValues = Record<string, CustomFieldValue>;

export interface KanbanCard {
  id: string;
  text: string;
  image?: string | null;
  description?: string;
  notes?: string | null;
  fields?: CustomFieldValues;
}

export interface KanbanColumn {
  id: string;
  title: string;
  cards: KanbanCard[];
}

export interface KanbanContent {
  columns: KanbanColumn[];
  fieldDefs?: CustomFieldDef[];
}

// El resto de plantillas también son JSON libre (`{ goals }`, `{ entries }`...) pero el móvil no
// tiene editor para ellas todavía — se tratan como opacas (`unknown`).
export type CustomPageContent = GalleryContent | NotaContent | KanbanContent | Record<string, unknown>;

export interface CustomPage extends CustomPageSummary {
  content: CustomPageContent;
}

export async function listCustomPages(): Promise<CustomPageSummary[]> {
  const res = await api.get<{ pages: CustomPageSummary[] }>("/custom-pages");
  return res.pages;
}

export const getCustomPage = (id: number) => api.get<CustomPage>(`/custom-pages/${id}`);
export const createCustomPage = (title: string, template: CustomPageTemplate) => api.post<CustomPage>("/custom-pages", { title, template });
export const deleteCustomPage = (id: number) => api.delete<{ message: string }>(`/custom-pages/${id}`);
export const moveCustomPage = (id: number, direction: "up" | "down") => api.put<CustomPageSummary>(`/custom-pages/${id}/move`, { direction });

export const updateCustomPage = (id: number, patch: { title?: string; subtitle?: string | null; content?: CustomPageContent }) =>
  api.put<CustomPage>(`/custom-pages/${id}`, patch);
