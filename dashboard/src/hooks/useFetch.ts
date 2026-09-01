import { useEffect, useState, useCallback, useRef } from "react";
import { ApiError } from "../api/client";

interface FetchState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  // Devuelve una promesa que se resuelve cuando el recargado termina (éxito o error) — antes era
  // `() => void`, "dispara y olvida". La mayoría de sitios lo siguen usando así (no hace falta
  // tocarlos: una función `async` sigue siendo válida donde se esperaba `() => void`), pero quien
  // necesite encadenar algo DESPUÉS de que la lista esté realmente actualizada (p.ej. cambiar de
  // pestaña a una página recién creada, ver DashboardPage.createCustomPage) ahora puede hacer
  // `await reload()` en vez de asumir que ya habrá terminado.
  reload: () => Promise<void>;
}

/** Hook simple para GET con estado de loading/error. Vuelve a cargar cuando cambian las `deps`. */
export function useFetch<T>(fetcher: () => Promise<T>, deps: unknown[] = []): FetchState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Ref (no closure directa) para que `reload` pueda llamar siempre a la versión más reciente de
  // `fetcher` sin tener que llevarlo en sus propias deps (que rompería su identidad estable).
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const load = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetcherRef.current();
      setData(result);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Error de red");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetcherRef
      .current()
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : "Error de red");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, loading, error, reload: load };
}
