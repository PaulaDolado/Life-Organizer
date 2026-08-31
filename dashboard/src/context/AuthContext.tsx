import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from "react";
import { api, setAuthToken } from "../api/client";
import { AuthResponse, User } from "../types";

const STORAGE_KEY = "life-organizer:auth";

interface StoredAuth {
  token: string;
  refreshToken: string;
  user: User;
}

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  error: string | null;
  login: (identifier: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string, name: string, timezone?: string) => Promise<void>;
  logout: () => void;
  // No llama a la API — solo sincroniza React state + localStorage con un perfil ya guardado en
  // el backend (ver ProfileDialog: hace el PUT /auth/me ella misma y luego llama a esto). Deja
  // token/refreshToken intactos, a diferencia de `persist` (que se usa solo en login/register).
  // El resto de la app (p.ej. el pie de la barra lateral, ver AppShell) lee siempre `user` de
  // este contexto, así que cualquier llamada a `updateUser` se refleja ahí al instante.
  updateUser: (patch: Partial<User>) => void;
  resendVerification: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function loadStoredAuth(): StoredAuth | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredAuth;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const stored = loadStoredAuth();
    if (!stored) return;
    setAuthToken(stored.token);
    setUser(stored.user); // primero la caché, para pintar algo sin esperar a la red

    // localStorage es solo una caché de arranque rápido, NO la fuente de verdad: si el perfil
    // se editó desde otra sesión/dispositivo (o si un `updateUser()` de aquí se quedó
    // desincronizado del backend por lo que sea), sin este refresco esa copia vieja se queda
    // pegada indefinidamente — nunca se corrige sola con un simple recargar la página. Best
    // effort: si falla (sin red, token caducado...), no pasa nada, cada página ya muestra su
    // propio error al hacer su primera petición — no forzamos logout desde aquí por eso.
    api
      .get<User>("/auth/me")
      .then((freshUser) => {
        setUser(freshUser);
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...stored, user: freshUser }));
      })
      .catch(() => {});
  }, []);

  const persist = (auth: AuthResponse) => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ token: auth.token, refreshToken: auth.refreshToken, user: auth.user })
    );
    setAuthToken(auth.token);
    setUser(auth.user);
  };

  const login = useCallback(async (identifier: string, password: string) => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.post<AuthResponse>("/auth/login", { identifier, password });
      persist(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al iniciar sesión");
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const register = useCallback(async (username: string, email: string, password: string, name: string, timezone?: string) => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.post<AuthResponse>("/auth/register", { username, email, password, name, timezone });
      persist(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al registrarse");
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setAuthToken(null);
    setUser(null);
  }, []);

  const updateUser = useCallback((patch: Partial<User>) => {
    const stored = loadStoredAuth();
    setUser((prev) => {
      if (!prev) return prev;
      const next = { ...prev, ...patch };
      if (stored) localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...stored, user: next }));
      return next;
    });
  }, []);

  const resendVerification = useCallback(async () => {
    await api.post("/auth/resend-verification", {});
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, error, login, register, logout, updateUser, resendVerification }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de <AuthProvider>");
  return ctx;
}
