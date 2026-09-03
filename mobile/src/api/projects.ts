// Cliente REST directo para "Proyectos" (cuaderno de proyectos) — mismo criterio que
// src/api/goals.ts, src/api/finance.ts y src/api/customPages.ts: Project/ProjectPage/ProjectTask
// no forman parte del contrato de sync offline del backend, así que esta sección no pasa por
// SQLite y necesita conexión, igual que dashboard/src/pages/ProyectosPage.tsx.
import { api } from "./client";

export type ProjectStatus = "idea" | "en_curso" | "pausado" | "completado";
export type ProjectPriority = "low" | "medium" | "high";

export interface ProjectTask {
  id: number;
  title: string;
  completed: boolean;
}

export interface Project {
  id: number;
  title: string;
  description: string | null;
  status: ProjectStatus;
  priority: ProjectPriority;
  deadline: string | null;
  tasks?: ProjectTask[];
  progress?: { total: number; completed: number; percent: number };
}

// Página de la libreta: `content` es HTML enriquecido en el servidor (así lo escribe el editor de
// la web, con negrita/listas/imágenes) — el móvil todavía no tiene un editor de texto enriquecido
// (no hay ninguna librería de rich text en package.json), así que edita/mira el contenido como
// texto plano. Ver htmlToPlainText/plainTextToHtml más abajo para la conversión en los dos
// sentidos: abrir una página escrita desde la web no debe enseñar las etiquetas HTML tal cual, y
// guardar desde el móvil no debe destrozar el HTML existente más de lo imprescindible.
export interface ProjectPage {
  id: number;
  projectId: number;
  title: string;
  content: string;
  order: number;
}

export interface RecentProjectEntry {
  id: number;
  projectId: number;
  projectTitle: string;
  pageTitle: string;
  preview: string;
  updatedAt: string;
}

export async function listProjects(): Promise<Project[]> {
  const res = await api.get<{ projects: Project[] }>("/projects");
  return res.projects;
}

export const getProject = (id: number) => api.get<Project>(`/projects/${id}`);

export const createProject = (title: string, description?: string | null) =>
  api.post<Project>("/projects", { title, description: description ?? null });

export const updateProjectStatus = (id: number, status: ProjectStatus) => api.put<Project>(`/projects/${id}`, { status });

export const deleteProject = (id: number) => api.delete<{ message: string }>(`/projects/${id}`);

export async function listRecentEntries(): Promise<RecentProjectEntry[]> {
  const res = await api.get<{ entries: RecentProjectEntry[] }>("/projects/recent-entries");
  return res.entries;
}

// --- Apuntes rápidos (tasks) ---

export const addProjectTask = (projectId: number, title: string) => api.post<ProjectTask>(`/projects/${projectId}/tasks`, { title });

export const updateProjectTask = (projectId: number, taskId: number, title: string) =>
  api.put<ProjectTask>(`/projects/${projectId}/tasks/${taskId}`, { title });

export const setProjectTaskCompleted = (projectId: number, taskId: number, completed: boolean) =>
  api.put<ProjectTask>(`/projects/${projectId}/tasks/${taskId}/complete`, { completed });

export const deleteProjectTask = (projectId: number, taskId: number) =>
  api.delete<{ message: string }>(`/projects/${projectId}/tasks/${taskId}`);

// --- Páginas de la libreta ---

export async function listProjectPages(projectId: number): Promise<ProjectPage[]> {
  const res = await api.get<{ pages: ProjectPage[] }>(`/projects/${projectId}/pages`);
  return res.pages;
}

export const addProjectPage = (projectId: number, title: string) => api.post<ProjectPage>(`/projects/${projectId}/pages`, { title });

export const updateProjectPage = (projectId: number, pageId: number, patch: { title?: string; content?: string }) =>
  api.put<ProjectPage>(`/projects/${projectId}/pages/${pageId}`, patch);

export const deleteProjectPage = (projectId: number, pageId: number) =>
  api.delete<{ message: string }>(`/projects/${projectId}/pages/${pageId}`);

// Convierte el HTML de una página (escrita desde el editor enriquecido de la web) en texto plano
// legible: cambia las etiquetas de bloque más comunes por saltos de línea ANTES de tirar el resto
// de etiquetas, para no aplastar varios párrafos/líneas de lista en una sola frase corrida. Pierde
// negrita/cursiva/imágenes (no hay editor de texto enriquecido en el móvil) — es una lectura fiel
// del texto, no una vista previa fiel del formato.
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
