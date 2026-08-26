import { useEffect, useRef, useState } from "react";
import { PageHeader } from "../components/AppShell";
import { api } from "../api/client";
import { useFetch } from "../hooks/useFetch";
import { Loading, ErrorMessage, EmptyState } from "../components/Feedback";
import { RichTextEditor } from "../components/RichTextEditor";
import { Project, ProjectPage } from "../types";

const STATUS_LABELS: Record<Project["status"], string> = {
  idea: "Idea",
  en_curso: "En curso",
  pausado: "Pausado",
  completado: "Completado",
};
const STATUS_ORDER: Project["status"][] = ["idea", "en_curso", "pausado", "completado"];

export function ProyectosPage() {
  const [title, setTitle] = useState("");
  const [quickNote, setQuickNote] = useState("");
  const [openId, setOpenId] = useState<number | null>(null);
  const { data, loading, error, reload } = useFetch(() => api.get<{ projects: Project[] }>("/projects"), []);

  return (
    <>
      <PageHeader title="Cuaderno de proyectos" subtitle="Apunta, anota y sigue el progreso" />

      {openId === null && (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!title.trim()) return;
            const note = quickNote.trim();
            const created = await api.post<Project>("/projects", { title: title.trim(), description: note || null });
            if (note) {
              await api.post(`/projects/${created.id}/tasks`, { title: note });
            }
            setTitle("");
            setQuickNote("");
            reload();
          }}
          className="mb-10 grid gap-4 card-soft md:grid-cols-[1fr_2fr_auto]"
        >
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Nombre del proyecto" className="field-input" />
          <input
            value={quickNote}
            onChange={(e) => setQuickNote(e.target.value)}
            placeholder="Apunte rápido (opcional) — ¿de qué trata?"
            className="field-input"
          />
          <button type="submit" className="btn-dark">
            Abrir página
          </button>
        </form>
      )}

      {error && <ErrorMessage message={error} />}

      {openId !== null ? (
        <ProjectNotebook
          projectId={openId}
          onBack={() => setOpenId(null)}
          onChanged={reload}
        />
      ) : loading ? (
        <Loading label="Cargando proyectos..." />
      ) : (data?.projects.length ?? 0) === 0 ? (
        <EmptyState message="Todavía no tienes proyectos." />
      ) : (
        <div className="grid gap-x-6 gap-y-12 sm:grid-cols-2 xl:grid-cols-3">
          {data?.projects.map((project, i) => (
            <NotebookCover key={project.id} project={project} dark={i % 2 === 0} onOpen={() => setOpenId(project.id)} />
          ))}
        </div>
      )}
    </>
  );
}

function NotebookCover({ project, dark, onOpen }: { project: Project; dark: boolean; onOpen: () => void }) {
  return (
    <button
      onClick={onOpen}
      className={`relative flex cursor-pointer flex-col rounded-3xl pt-10 p-6 text-left transition-transform hover:-translate-y-1 ${
        dark ? "bg-foreground text-background" : "border border-secondary bg-secondary"
      }`}
    >
      <div aria-hidden className="absolute inset-x-0 top-0 flex -translate-y-1/2 justify-evenly px-8">
        {Array.from({ length: 7 }).map((_, i) => (
          <span
            key={i}
            className={`size-4 rounded-full border-[3px] bg-background shadow-sm ${dark ? "border-foreground/40" : "border-muted-foreground/40"}`}
          />
        ))}
      </div>

      <div className="flex items-start justify-between gap-4">
        <h2 className="font-serif text-2xl">{project.title}</h2>
        <span className={`whitespace-nowrap rounded-full px-3 py-1 text-xs ${dark ? "bg-background/20" : "bg-foreground/10"}`}>
          {STATUS_LABELS[project.status]}
        </span>
      </div>

      {project.description && <p className={`mt-2 text-sm ${dark ? "opacity-70" : "text-muted-foreground"}`}>{project.description}</p>}

      <span className={`mt-6 text-xs ${dark ? "opacity-50" : "text-muted-foreground"}`}>Haz clic para abrir tus apuntes →</span>
    </button>
  );
}

function ProjectNotebook({ projectId, onBack, onChanged }: { projectId: number; onBack: () => void; onChanged: () => void }) {
  const { data: project, loading, error, reload } = useFetch(() => api.get<Project>(`/projects/${projectId}`), [projectId]);
  const [note, setNote] = useState("");

  const cycleStatus = async () => {
    if (!project) return;
    const next = STATUS_ORDER[(STATUS_ORDER.indexOf(project.status) + 1) % STATUS_ORDER.length];
    await api.put(`/projects/${projectId}`, { status: next });
    reload();
    onChanged();
  };

  const removeProject = async () => {
    await api.delete(`/projects/${projectId}`);
    onChanged();
    onBack();
  };

  return (
    <div>
      <button onClick={onBack} className="mb-6 cursor-pointer text-sm text-muted-foreground hover:text-foreground">
        ← Volver a la galería
      </button>

      {loading ? (
        <Loading label="Abriendo cuaderno..." />
      ) : error ? (
        <ErrorMessage message={error} />
      ) : !project ? null : (
        <div className="rounded-3xl border border-secondary bg-card p-8">
          <div className="flex items-start justify-between gap-4">
            <h1 className="font-serif text-3xl">{project.title}</h1>
            <button
              onClick={cycleStatus}
              className="cursor-pointer whitespace-nowrap rounded-full bg-secondary px-3 py-1 text-xs transition-colors hover:bg-secondary/70"
            >
              {STATUS_LABELS[project.status]}
            </button>
          </div>

          {/* Apuntes rápidos — lo primero que se ve al abrir la libreta. A la mitad del ancho:
              son notas cortas tipo checklist, no necesitan estirarse a todo el ancho del cuaderno
              como sí lo necesita el editor de Páginas. */}
          <section className="mt-8 lg:max-w-[50%]">
            <h2 className="mb-4 text-xs font-medium uppercase tracking-widest text-muted-foreground">Apuntes rápidos</h2>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!note.trim()) return;
                await api.post(`/projects/${projectId}/tasks`, { title: note.trim() });
                setNote("");
                reload();
              }}
              className="mb-4"
            >
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Escribe un apunte rápido…"
                className="field-input w-full"
              />
            </form>

            {(project.tasks?.length ?? 0) === 0 ? (
              <p className="text-sm text-muted-foreground">Aún no tienes apuntes en esta libreta.</p>
            ) : (
              <ul className="space-y-2">
                {project.tasks?.map((t) => (
                  <li key={t.id}>
                    <button
                      onClick={async () => {
                        if (!t.completed) {
                          await api.put(`/projects/${projectId}/tasks/${t.id}/complete`);
                          reload();
                        }
                      }}
                      className="flex w-full cursor-pointer items-center gap-3 rounded-xl border border-border bg-background px-4 py-3 text-left text-sm"
                    >
                      <span
                        className={`flex size-4 shrink-0 items-center justify-center rounded-sm border text-[9px] ${
                          t.completed ? "border-primary bg-primary/20 text-primary" : "border-foreground/30"
                        }`}
                      >
                        {t.completed ? "✓" : ""}
                      </span>
                      <span className={t.completed ? "line-through opacity-50" : ""}>{t.title}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Páginas — el resto de la libreta, como un documento de texto con listas e imágenes */}
          <section className="mt-10 border-t border-border pt-8">
            <h2 className="mb-4 text-xs font-medium uppercase tracking-widest text-muted-foreground">Páginas</h2>
            <ProjectPages projectId={projectId} />
          </section>

          <div className="mt-8 flex items-center justify-between border-t border-border pt-6 text-xs text-muted-foreground">
            <span>
              {project.progress?.completed ?? 0}/{project.progress?.total ?? 0} apuntes resueltos · prioridad {project.priority}
            </span>
            <button onClick={removeProject} className="cursor-pointer hover:text-destructive">
              Eliminar proyecto
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ProjectPages({ projectId }: { projectId: number }) {
  const { data, loading, error, reload } = useFetch(
    () => api.get<{ pages: ProjectPage[] }>(`/projects/${projectId}/pages`),
    [projectId]
  );
  const pages = data?.pages ?? [];

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [content, setContent] = useState("");
  const [pageTitle, setPageTitle] = useState("");
  const [savingState, setSavingState] = useState<"idle" | "saving" | "saved">("idle");
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Selecciona la primera página en cuanto cargan, y carga su contenido al cambiar de página.
  useEffect(() => {
    if (selectedId === null && pages.length > 0) {
      setSelectedId(pages[0].id);
      setContent(pages[0].content);
      setPageTitle(pages[0].title);
    }
  }, [pages, selectedId]);

  const selectPage = (page: ProjectPage) => {
    setSelectedId(page.id);
    setContent(page.content);
    setPageTitle(page.title);
  };

  const savePage = (pageId: number, html: string) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setSavingState("saving");
    saveTimer.current = setTimeout(async () => {
      await api.put(`/projects/${projectId}/pages/${pageId}`, { content: html });
      setSavingState("saved");
    }, 600);
  };

  // El título se guarda al perder el foco (no en cada tecla como el contenido): así no
  // dispara una llamada por letra, y la pestaña de la página se actualiza en cuanto se confirma.
  const saveTitle = async () => {
    if (selectedId === null) return;
    const trimmed = pageTitle.trim();
    if (!trimmed) return;
    await api.put(`/projects/${projectId}/pages/${selectedId}`, { title: trimmed });
    reload();
  };

  const addPage = async () => {
    const created = await api.post<ProjectPage>(`/projects/${projectId}/pages`, { title: `Página ${pages.length + 1}` });
    reload();
    setSelectedId(created.id);
    setContent(created.content);
    setPageTitle(created.title);
  };

  const removePage = async (pageId: number) => {
    await api.delete(`/projects/${projectId}/pages/${pageId}`);
    if (selectedId === pageId) setSelectedId(null);
    reload();
  };

  if (loading) return <Loading label="Cargando páginas..." />;
  if (error) return <ErrorMessage message={error} />;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {pages.map((page) => (
          <button
            key={page.id}
            onClick={() => selectPage(page)}
            className={`group relative cursor-pointer whitespace-nowrap rounded-full px-4 py-1.5 text-xs transition-colors ${
              page.id === selectedId ? "bg-primary text-primary-foreground" : "border border-border text-muted-foreground hover:border-primary/30"
            }`}
          >
            {page.title}
            <span
              role="button"
              title="Eliminar página"
              onClick={(e) => {
                e.stopPropagation();
                removePage(page.id);
              }}
              className="ml-2 cursor-pointer opacity-60 hover:opacity-100"
            >
              ✕
            </span>
          </button>
        ))}
        <button onClick={addPage} className="cursor-pointer rounded-full border border-dashed border-border px-4 py-1.5 text-xs text-muted-foreground hover:border-primary/30 hover:text-foreground">
          + Página
        </button>
      </div>

      {pages.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aún no tienes páginas. Crea una para escribir con formato, listas e imágenes.</p>
      ) : selectedId === null ? null : (
        <>
          <input
            value={pageTitle}
            onChange={(e) => setPageTitle(e.target.value)}
            onBlur={saveTitle}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            }}
            placeholder="Título de la página"
            className="mb-3 w-full border-b border-border bg-transparent pb-2 font-serif text-xl outline-none focus:border-primary"
          />
          <RichTextEditor
            key={selectedId}
            value={content}
            onChange={(html) => {
              setContent(html);
              savePage(selectedId, html);
            }}
            placeholder="Escribe aquí… puedes usar listas, negrita, cursiva e insertar imágenes."
          />
          <p className="mt-2 text-xs text-muted-foreground">
            {savingState === "saving" ? "Guardando..." : savingState === "saved" ? "Guardado" : ""}
          </p>
        </>
      )}
    </div>
  );
}
