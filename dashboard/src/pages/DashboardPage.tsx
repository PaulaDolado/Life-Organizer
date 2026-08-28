import { useState } from "react";
import { AppShell, SearchFocus, Tab } from "../components/AppShell";
import { HoyPage } from "./HoyPage";
import { AgendaPage } from "./AgendaPage";
import { PlanificadorPage } from "./PlanificadorPage";
import { SchedulePage } from "./SchedulePage";
import { MetasPage } from "./MetasPage";
import { FinanzasPage } from "./FinanzasPage";
import { MetasAhorroPage } from "./MetasAhorroPage";
import { ProyectosPage } from "./ProyectosPage";
import { HobbiesPage } from "./HobbiesPage";

export function DashboardPage() {
  const [activeTab, setActiveTab] = useState<Tab>("hoy");
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
    <AppShell activeTab={activeTab} onTabChange={(tab) => navigate(tab)} onSearchNavigate={navigate}>
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
        <PlanificadorPage focusTaskId={focus?.type === "task" ? focus.id : undefined} onFocusHandled={clearFocus} />
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
