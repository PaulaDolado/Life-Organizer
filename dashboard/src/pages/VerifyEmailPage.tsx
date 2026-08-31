import { useEffect, useState } from "react";
import { api, ApiError } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { User } from "../types";

// Página de aterrizaje del enlace de verificación (`/verify-email?token=...`, ver mailer.ts en
// el backend: es la URL que construye para el email). No depende de estar logueado — el token
// por sí solo basta (POST /auth/verify-email es público) — pero si esta pestaña SÍ tiene sesión
// activa y es la misma cuenta, refrescamos el contexto para que el aviso de "sin verificar" en
// la barra lateral desaparezca sin tener que recargar.
export function VerifyEmailPage() {
  const { user, updateUser } = useAuth();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get("token");
    if (!token) {
      setStatus("error");
      setMessage("El enlace no incluye un token de verificación.");
      return;
    }
    api
      .post<User>("/auth/verify-email", { token })
      .then((profile) => {
        setStatus("success");
        if (user && user.id === profile.id) {
          updateUser({ emailVerified: profile.emailVerified });
        }
      })
      .catch((err) => {
        setStatus("error");
        setMessage(err instanceof ApiError ? err.message : "No se pudo verificar el email.");
      });
    // Solo al montar: un solo intento por visita a esta página, aunque `user` cambie después.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const goToApp = () => {
    window.location.href = "/";
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4 font-sans">
      <div className="card-soft flex w-full max-w-sm flex-col items-center gap-4 text-center">
        <div className="mb-1 flex items-center justify-center gap-3">
          <div className="size-8 rounded-full bg-primary" />
          <h1 className="font-serif text-2xl">Life Organizer</h1>
        </div>

        {status === "loading" && <p className="text-sm text-muted-foreground">Verificando tu email…</p>}

        {status === "success" && (
          <>
            <p className="text-2xl">✓</p>
            <p className="text-sm">Tu email ha quedado verificado.</p>
          </>
        )}

        {status === "error" && (
          <>
            <p className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">⚠️ {message}</p>
            <p className="text-xs text-muted-foreground">
              Si el enlace caducó, pide uno nuevo desde tu perfil ("Reenviar verificación") una vez dentro de la app.
            </p>
          </>
        )}

        <button type="button" onClick={goToApp} className="btn-primary mt-2 w-full">
          Ir a la app
        </button>
      </div>
    </div>
  );
}
