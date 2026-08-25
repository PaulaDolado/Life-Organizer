import { FormEvent, useState } from "react";
import { PageHeader } from "../components/AppShell";
import { api } from "../api/client";
import { useFetch } from "../hooks/useFetch";
import { Loading, ErrorMessage, EmptyState } from "../components/Feedback";
import { Hobby, HobbyAnalytics, HobbyCategory } from "../types";

const CATEGORIES: { value: HobbyCategory; label: string; icon: string }[] = [
  { value: "reading", label: "Lectura", icon: "📖" },
  { value: "gaming", label: "Gaming", icon: "🎮" },
  { value: "music", label: "Música", icon: "🎸" },
  { value: "sports", label: "Deporte", icon: "⚽" },
  { value: "art", label: "Arte", icon: "🎨" },
];

function startOfWeek(d: Date): Date {
  const copy = new Date(d);
  const day = (copy.getDay() + 6) % 7;
  copy.setDate(copy.getDate() - day);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

export function HobbiesPage() {
  const [open, setOpen] = useState(false);
  const { data, loading, error, reload } = useFetch(() => api.get<{ hobbies: Hobby[] }>("/hobbies"), []);

  return (
    <>
      <PageHeader
        title="Hobbies"
        subtitle="Tus intereses y el ritmo con el que los mantienes"
        action={
          <button onClick={() => setOpen((v) => !v)} className="btn-dark">
            {open ? "Cerrar" : "+ Nuevo hobby"}
          </button>
        }
      />

      {open && (
        <NewHobbyForm
          onSubmit={async (input) => {
            await api.post("/hobbies", input);
            setOpen(false);
            reload();
          }}
        />
      )}

      {error && <ErrorMessage message={error} />}
      {loading ? (
        <Loading label="Cargando hobbies..." />
      ) : (data?.hobbies.length ?? 0) === 0 ? (
        <EmptyState message="Todavía no tienes hobbies registrados." />
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          {data?.hobbies.map((hobby) => (
            <HobbyCard key={hobby.id} hobby={hobby} onChanged={reload} />
          ))}
        </div>
      )}
    </>
  );
}

function HobbyCard({ hobby, onChanged }: { hobby: Hobby; onChanged: () => void }) {
  const [minutes, setMinutes] = useState("30");
  const { data: analytics, reload } = useFetch(
    () => api.get<HobbyAnalytics>(`/hobbies/${hobby.id}/analytics`),
    [hobby.id]
  );
  const icon = CATEGORIES.find((c) => c.value === hobby.category)?.icon ?? "🎯";

  const weekStart = startOfWeek(new Date()).getTime();
  const sessionsThisWeek = (analytics?.recentSessions ?? []).filter((s) => new Date(s.date).getTime() >= weekStart).length;

  const logSession = async (e: FormEvent) => {
    e.preventDefault();
    const n = Number(minutes);
    if (!n) return;
    await api.post(`/hobbies/${hobby.id}/sessions`, { durationMinutes: n });
    reload();
    onChanged();
  };

  const remove = async () => {
    await api.delete(`/hobbies/${hobby.id}`);
    onChanged();
  };

  return (
    <article className="card-soft flex flex-col gap-4">
      <div className="flex items-start justify-between gap-2">
        <h2 className="flex items-center gap-2 font-serif text-2xl">
          <span aria-hidden="true">{icon}</span> {hobby.name}
        </h2>
        <button onClick={remove} className="cursor-pointer text-xs text-muted-foreground hover:text-destructive">
          Eliminar
        </button>
      </div>
      {hobby.description && <p className="text-sm text-muted-foreground">{hobby.description}</p>}

      <p className="text-sm font-medium text-primary">{sessionsThisWeek} sesiones esta semana</p>
      <p className="text-xs text-muted-foreground">
        {analytics ? `${analytics.totalHours}h totales · ${analytics.totalSessions} sesiones registradas` : "Cargando estadísticas..."}
      </p>

      <form onSubmit={logSession} className="flex items-center gap-2">
        <input
          type="number"
          min="1"
          value={minutes}
          onChange={(e) => setMinutes(e.target.value)}
          className="field-input w-20"
        />
        <span className="text-xs text-muted-foreground">min</span>
        <button type="submit" className="btn-primary ml-auto px-4 py-2 text-xs">
          Registrar sesión
        </button>
      </form>
    </article>
  );
}

interface NewHobbyInput {
  name: string;
  category: HobbyCategory;
  description?: string;
}

function NewHobbyForm({ onSubmit }: { onSubmit: (input: NewHobbyInput) => Promise<void> }) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState<HobbyCategory>("reading");

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        if (!name.trim()) return;
        await onSubmit({ name: name.trim(), category });
        setName("");
      }}
      className="mb-10 grid gap-4 card-soft md:grid-cols-[2fr_1fr_auto]"
    >
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre del hobby" className="field-input" />
      <select value={category} onChange={(e) => setCategory(e.target.value as HobbyCategory)} className="field-input">
        {CATEGORIES.map((c) => (
          <option key={c.value} value={c.value}>
            {c.icon} {c.label}
          </option>
        ))}
      </select>
      <button type="submit" className="btn-dark">
        Crear hobby
      </button>
    </form>
  );
}
