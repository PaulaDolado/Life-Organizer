import { createContext, useContext, useState, useCallback, useEffect, useRef, ReactNode } from "react";
import { api, setTokens, setAuthCallbacks } from "../api/client";
import { loadStoredAuth, persistAuth, persistTokens, clearAuth } from "./storage";
import { AuthResponse, User } from "../types";

interface AuthContextValue {
  user: User | null;
  ready: boolean; // true una vez se comprobó si había una sesión guardada (evita parpadeo Login→Hoy)
  loading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string, name: string, timezone?: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Evita el warning de React al hacer setUser desde un callback que puede seguir vivo tras
  // desmontar (poco probable en la raíz de la app, pero barato de evitar).
  const mounted = useRef(true);
  useEffect(() => () => void (mounted.current = false), []);

  useEffect(() => {
    // Si el refresh automático del cliente HTTP consigue tokens nuevos, o si falla del todo
    // (refresh token también caducado), hay que reflejarlo aquí — es la única fuente de verdad
    // de "hay sesión o no" para el resto de la app.
    setAuthCallbacks({
      onRefreshed: (token, refreshToken) => {
        void persistTokens(token, refreshToken);
      },
      onAuthExpired: () => {
        void clearAuth();
        if (mounted.current) setUser(null);
      },
    });

    loadStoredAuth().then((stored) => {
      if (stored) {
        setTokens(stored.token, stored.refreshToken);
        if (mounted.current) setUser(stored.user);
      }
      if (mounted.current) setReady(true);
    });
  }, []);

  const applyAuth = (auth: AuthResponse) => {
    setTokens(auth.token, auth.refreshToken);
    setUser(auth.user);
  };

  const login = useCallback(async (email: string, password: string) => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.post<AuthResponse>("/auth/login", { email, password });
      await persistAuth(result);
      applyAuth(result);
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
      await persistAuth(result);
      applyAuth(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al registrarse");
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    await clearAuth();
    setTokens(null, null);
    setUser(null);
  }, []);

  return <AuthContext.Provider value={{ user, ready, loading, error, login, register, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de <AuthProvider>");
  return ctx;
}
