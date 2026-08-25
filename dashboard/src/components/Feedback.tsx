export function Loading({ label = "Cargando..." }: { label?: string }) {
  return <p className="p-8 text-center text-sm text-muted-foreground">{label}</p>;
}

export function ErrorMessage({ message }: { message: string }) {
  return (
    <p className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
      ⚠️ {message}
    </p>
  );
}

export function EmptyState({ message }: { message: string }) {
  return (
    <p className="rounded-2xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
      {message}
    </p>
  );
}
