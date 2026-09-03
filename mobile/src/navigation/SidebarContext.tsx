import { createContext, useContext, useState, ReactNode } from "react";

// Comparte si el menú lateral (ver AppSidebar.tsx) está colapsado o no con el resto de la app —
// hace falta fuera de AppSidebar porque, con el menú colapsado, el clip flotante queda encima del
// borde izquierdo de CUALQUIER pantalla (AppSidebar es el `tabBar`, no un padre de las pantallas),
// y cada pantalla pinta su propia cabecera con su propio padding (no hay un <PageHeader>
// compartido como en la web, ver comentario en AppShell.tsx) — así que cada una necesita saber si
// debe dejar hueco a la izquierda para que el título no quede pegado al clip. Mismo criterio que
// el `collapsed ? "lg:pl-24" : "lg:pl-12"` de la web.
interface SidebarContextValue {
  collapsed: boolean;
  setCollapsed: (value: boolean | ((prev: boolean) => boolean)) => void;
}

const SidebarContext = createContext<SidebarContextValue | undefined>(undefined);

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  return <SidebarContext.Provider value={{ collapsed, setCollapsed }}>{children}</SidebarContext.Provider>;
}

export function useSidebar(): SidebarContextValue {
  const ctx = useContext(SidebarContext);
  if (!ctx) throw new Error("useSidebar debe usarse dentro de <SidebarProvider>");
  return ctx;
}

// Padding izquierdo extra que necesita la cabecera de una pantalla con el menú colapsado, para
// que su título no quede pegado al clip flotante (CLIP_OPEN_H de AppSidebar.tsx ronda 28px de
// ancho visual apoyado en left:4 — este valor deja un margen claro después de su borde derecho).
export const SIDEBAR_CLIP_CLEARANCE = 44;
