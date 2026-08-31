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
  // En login, un único campo sirve como username O email (ver authService.login: busca por
  // cualquiera de los dos). En registro hacen falta los dos por separado.
  const [identifier, setIdentifier] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      if (mode === "login") {
        await login(identifier, password);
      } else {
        await register(username, email, password, name, detectTimezone());
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

        {mode === "register" && (
          <label className="flex flex-col gap-1 text-xs font-bold uppercase tracking-widest text-muted-foreground">
            Nombre de usuario
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              minLength={3}
              maxLength={30}
              placeholder="paula.dolado"
              title="Minúsculas, números, puntos o guiones bajos"
              className="field-input normal-case tracking-normal"
            />
          </label>
        )}

        {mode === "login" ? (
          <label className="flex flex-col gap-1 text-xs font-bold uppercase tracking-widest text-muted-foreground">
            Usuario o email
            <input
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              required
              placeholder="demo o demo@lifeorganizer.dev"
              className="field-input normal-case tracking-normal"
            />
          </label>
        ) : (
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
        )}

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

        {mode === "register" && (
          <p className="-mt-2 text-xs text-muted-foreground">
            Después de registrarte tendrás que verificar tu email — mientras tanto puedes usar la app con normalidad.
          </p>
        )}

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
