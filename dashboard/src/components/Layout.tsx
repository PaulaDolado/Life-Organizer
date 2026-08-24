import { ReactNode } from "react";
import { useAuth } from "../context/AuthContext";

export type Tab = "agenda" | "goals" | "finance" | "projects" | "hobbies";

const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: "agenda", label: "Agenda", icon: "📅" },
  { key: "goals", label: "Metas", icon: "🎯" },
  { key: "finance", label: "Finanzas", icon: "💰" },
  { key: "projects", label: "Proyectos", icon: "🚀" },
  { key: "hobbies", label: "Hobbies", icon: "🎮" },
];

interface LayoutProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
  children: ReactNode;
}

export function Layout({ activeTab, onTabChange, children }: LayoutProps) {
  const { user, logout } = useAuth();

  return (
    <div className="layout">
      <header className="layout__header">
        <h1>Life Organizer</h1>
        <div className="layout__user">
          <span>{user?.name}</span>
          <button className="button button--ghost" onClick={logout}>
            Cerrar sesión
          </button>
        </div>
      </header>

      <nav className="layout__nav">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            className={`layout__tab ${activeTab === tab.key ? "layout__tab--active" : ""}`}
            onClick={() => onTabChange(tab.key)}
          >
            <span aria-hidden="true">{tab.icon}</span> {tab.label}
          </button>
        ))}
      </nav>

      <main className="layout__content">{children}</main>
    </div>
  );
}
