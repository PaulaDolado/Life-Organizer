import { FormEvent, useState } from "react";
import { useAuth } from "../context/AuthContext";

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
        await register(email, password, name);
      }
    } catch {
      // el error ya queda expuesto vía useAuth().error
    }
  };

  return (
    <div className="auth-page">
      <form className="auth-card" onSubmit={handleSubmit}>
        <h1>📅 Life Organizer</h1>
        <p className="auth-card__subtitle">
          {mode === "login" ? "Inicia sesión para continuar" : "Crea tu cuenta"}
        </p>

        {mode === "register" && (
          <label className="field">
            Nombre
            <input value={name} onChange={(e) => setName(e.target.value)} required minLength={2} />
          </label>
        )}

        <label className="field">
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="demo@lifeorganizer.dev"
          />
        </label>

        <label className="field">
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={mode === "register" ? 8 : undefined}
            placeholder="Password123"
          />
        </label>

        {error && <p className="feedback feedback--error">⚠️ {error}</p>}

        <button className="button button--primary" type="submit" disabled={loading}>
          {loading ? "Cargando..." : mode === "login" ? "Iniciar sesión" : "Registrarse"}
        </button>

        <button
          type="button"
          className="button button--link"
          onClick={() => setMode(mode === "login" ? "register" : "login")}
        >
          {mode === "login" ? "¿No tienes cuenta? Regístrate" : "¿Ya tienes cuenta? Inicia sesión"}
        </button>
      </form>
    </div>
  );
}
