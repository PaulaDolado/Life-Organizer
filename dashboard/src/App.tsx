import { useAuth } from "./context/AuthContext";
import { LoginPage } from "./pages/LoginPage";
import { DashboardPage } from "./pages/DashboardPage";
import { VerifyEmailPage } from "./pages/VerifyEmailPage";

// No hay router de verdad en la app (todo lo demás es navegación por pestañas con useState, ver
// AppShell) — pero el enlace de verificación de email (ver mailer.ts) es un link real que puede
// abrirse en una pestaña nueva sin sesión activa, así que necesita SU PROPIA ruta por path antes
// de decidir login vs dashboard.
export function App() {
  const { user } = useAuth();
  if (window.location.pathname === "/verify-email") return <VerifyEmailPage />;
  return user ? <DashboardPage /> : <LoginPage />;
}
