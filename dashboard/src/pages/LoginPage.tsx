import { FormEvent, useState } from "react";
import { useAuth } from "../context/AuthContext";

function detectTimezone(): string | undefined {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return undefined;
  }
}

export function LoginPage() {
  const { login, register, loading, error } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      if (mode === "login") {
        await login(email, password);
      } else {
        await register(email, password, name, detectTimezone());
      }
    } catch {
      // el error ya queda expuesto vía useAuth().error
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4 font-sans">
      <form onSubmit={handleSubmit} className="card-soft flex w-full max-w-sm flex-col gap-4">
        <div className="mb-2 flex items-center justify-center gap-3">
          <div className="size-8 rounded-full bg-primary" />
          <h1 className="font-serif text-3xl">Life Organizer</h1>
        </div>
        <p className="-mt-2 text-center text-sm text-muted-foreground">
          {mode === "login" ? "Inicia sesión para continuar" : "Crea tu cuenta"}
        </p>

        {mode === "register" && (
          <label className="flex flex-col gap-1 text-xs font-bold uppercase tracking-widest text-muted-foreground">
            Nombre
            <input value={name} onChange={(e) => setName(e.target.value)} required minLength={2} className="field-input normal-case tracking-normal" />
          </label>
        )}

        <label className="flex flex-col gap-1 text-xs font-bold uppercase tracking-widest text-muted-foreground">
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="demo@lifeorganizer.dev"
            className="field-input normal-case tracking-normal"
          />
        </label>

        <label className="flex flex-col gap-1 text-xs font-bold uppercase tracking-widest text-muted-foreground">
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={mode === "register" ? 8 : undefined}
            placeholder="Password123"
            className="field-input normal-case tracking-normal"
          />
        </label>

        {error && <p className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">⚠️ {error}</p>}

        <button type="submit" disabled={loading} className="btn-primary mt-2">
          {loading ? "Cargando..." : mode === "login" ? "Iniciar sesión" : "Registrarse"}
        </button>

        <button
          type="button"
          onClick={() => setMode(mode === "login" ? "register" : "login")}
          className="cursor-pointer text-center text-xs text-muted-foreground hover:text-primary"
        >
          {mode === "login" ? "¿No tienes cuenta? Regístrate" : "¿Ya tienes cuenta? Inicia sesión"}
        </button>
      </form>
    </div>
  );
}
