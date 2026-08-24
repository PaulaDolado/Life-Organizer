import { useState } from "react";
import { Layout, Tab } from "../components/Layout";
import { AgendaWeekView } from "../components/AgendaWeekView";
import { GoalsList } from "../components/GoalsList";
import { FinanceSummary } from "../components/FinanceSummary";
import { ProjectsList } from "../components/ProjectsList";
import { HobbiesList } from "../components/HobbiesList";

const TAB_CONTENT: Record<Tab, () => JSX.Element> = {
  agenda: AgendaWeekView,
  goals: GoalsList,
  finance: FinanceSummary,
  projects: ProjectsList,
  hobbies: HobbiesList,
};

export function DashboardPage() {
  const [activeTab, setActiveTab] = useState<Tab>("agenda");
  const ActiveComponent = TAB_CONTENT[activeTab];

  return (
    <Layout activeTab={activeTab} onTabChange={setActiveTab}>
      <ActiveComponent />
    </Layout>
  );
}
