import { useState } from "react";
import { AppShell, Tab } from "../components/AppShell";
import { AgendaPage } from "./AgendaPage";
import { MetasPage } from "./MetasPage";
import { FinanzasPage } from "./FinanzasPage";
import { MetasAhorroPage } from "./MetasAhorroPage";
import { ProyectosPage } from "./ProyectosPage";
import { HobbiesPage } from "./HobbiesPage";

const TAB_CONTENT: Record<Tab, () => JSX.Element> = {
  agenda: AgendaPage,
  metas: MetasPage,
  finanzas: FinanzasPage,
  "finanzas-ahorro": MetasAhorroPage,
  proyectos: ProyectosPage,
  hobbies: HobbiesPage,
};

export function DashboardPage() {
  const [activeTab, setActiveTab] = useState<Tab>("agenda");
  const ActiveComponent = TAB_CONTENT[activeTab];

  return (
    <AppShell activeTab={activeTab} onTabChange={setActiveTab}>
      <ActiveComponent />
    </AppShell>
  );
}
