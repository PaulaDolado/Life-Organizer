import { useState } from "react";
import { AppShell, parseCustomPageTab, customPageTab, SearchFocus, Tab } from "../components/AppShell";
import { api } from "../api/client";
import { useFetch } from "../hooks/useFetch";
import { HoyPage } from "./HoyPage";
import { AgendaPage } from "./AgendaPage";
import { PlanificadorPage } from "./PlanificadorPage";
import { SchedulePage } from "./SchedulePage";
import { MetasPage } from "./MetasPage";
import { FinanzasPage } from "./FinanzasPage";
import { MetasAhorroPage } from "./MetasAhorroPage";
import { ProyectosPage } from "./ProyectosPage";
import { HobbiesPage } from "./HobbiesPage";
import { CustomPagePage } from "./CustomPagePage";
import { CustomPageSummary, CustomPageTemplate } from "../types";

// Tras conectar Google Calendar (ver GoogleCalendarMenu en AgendaPage), Google redirige el
// navegador completo de vuelta a la raíz con `?google=connected|error` en la URL — como no hay
// router real (ver App.tsx), sin este chequeo el usuario aterrizaría en "Hoy" sin ver el aviso.
function initialTab(): Tab {
  return new URLSearchParams(window.location.search).has("google") ? "agenda" : "hoy";
}

export function DashboardPage() {
  const [activeTab, setActiveTab] = useState<Tab>(initialTab);

  // Páginas personalizadas ("+ Nueva página", ver AppShell): una única carga aquí arriba, tanto
  // para pintar el menú lateral como para saber qué plantilla renderizar cuando activeTab
  // apunta a una de ellas (ver customPageTab/parseCustomPageTab).
  const { data: customPagesData, reload: reloadCustomPages } = useFetch(
    () => api.get<{ pages: CustomPageSummary[] }>("/custom-pages"),
    []
  );
  const customPages = customPagesData?.pages ?? [];
  const activeCustomPageId = parseCustomPageTab(activeTab);

  const createCustomPage = async (title: string, template: CustomPageTemplate) => {
    const created = await api.post<CustomPageSummary>("/custom-pages", { title, template });
    reloadCustomPages();
    setActiveTab(customPageTab(created.id));
  };

  const renameCustomPage = async (id: number, title: string) => {
    await api.put(`/custom-pages/${id}`, { title });
    reloadCustomPages();
  };

  // Para el ✕ del menú lateral (ver AppShell): borra de verdad en el servidor.
  const deleteCustomPage = async (id: number) => {
    await api.delete(`/custom-pages/${id}`);
    reloadCustomPages();
    if (parseCustomPageTab(activeTab) === id) setActiveTab("hoy");
  };

  // Para el botón "Eliminar página" dentro de la propia página (ver CustomPagePage): ese
  // componente ya hace el DELETE él mismo antes de avisar, así que aquí solo hay que refrescar
  // el menú y volver a "Hoy" — sin repetir la llamada (evitaría un 404 al borrar dos veces).
  const handleCustomPageDeleted = () => {
    reloadCustomPages();
    setActiveTab("hoy");
  };

  // Destino de un resultado de búsqueda global (ver AppShell.GlobalSearch): qué página debe
  // "recibirlo" al montar/cargar sus datos. Cada página consume el que le corresponde y avisa
  // con `onFocusHandled` para limpiarlo — así no se re-dispara en cada re-render, ni queda
  // pegado si el usuario cambia de pestaña a mano después.
  const [focus, setFocus] = useState<SearchFocus | null>(null);

  const navigate = (tab: Tab, nextFocus: SearchFocus | null = null) => {
    setFocus(nextFocus);
    setActiveTab(tab);
  };

  const clearFocus = () => setFocus(null);

  return (
    <AppShell
      activeTab={activeTab}
      onTabChange={(tab) => navigate(tab)}
      onSearchNavigate={navigate}
      customPages={customPages}
      onCreateCustomPage={createCustomPage}
      onRenameCustomPage={renameCustomPage}
      onDeleteCustomPage={deleteCustomPage}
    >
      {activeCustomPageId !== null && (
        <CustomPagePage pageId={activeCustomPageId} onRenamed={reloadCustomPages} onDeleted={handleCustomPageDeleted} />
      )}
      {activeTab === "hoy" && <HoyPage onNavigate={navigate} />}
      {activeTab === "agenda" && (
        <AgendaPage
          focusEventId={focus?.type === "event" ? focus.id : undefined}
          focusEventStartTime={focus?.type === "event" ? focus.startTime : undefined}
          onFocusHandled={clearFocus}
          onNavigate={navigate}
        />
      )}
      {activeTab === "planificador" && (
        <PlanificadorPage
          focusTaskId={focus?.type === "task" ? focus.id : undefined}
          focusPlannerId={focus?.type === "task" ? focus.plannerId : undefined}
          onFocusHandled={clearFocus}
        />
      )}
      {activeTab === "horario" && <SchedulePage />}
      {activeTab === "metas" && <MetasPage />}
      {activeTab === "finanzas" && <FinanzasPage />}
      {activeTab === "finanzas-ahorro" && <MetasAhorroPage />}
      {activeTab === "proyectos" && (
        <ProyectosPage focusProjectId={focus?.type === "project" ? focus.id : undefined} onFocusHandled={clearFocus} />
      )}
      {activeTab === "hobbies" && <HobbiesPage />}
    </AppShell>
  );
}
