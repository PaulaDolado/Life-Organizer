export function Loading({ label = "Cargando..." }: { label?: string }) {
  return <p className="feedback feedback--loading">{label}</p>;
}

export function ErrorMessage({ message }: { message: string }) {
  return <p className="feedback feedback--error">⚠️ {message}</p>;
}

export function EmptyState({ message }: { message: string }) {
  return <p className="feedback feedback--empty">{message}</p>;
}

export function ProgressBar({ percent }: { percent: number }) {
  const clamped = Math.max(0, Math.min(100, percent));
  return (
    <div className="progress-bar" role="progressbar" aria-valuenow={clamped} aria-valuemin={0} aria-valuemax={100}>
      <div className="progress-bar__fill" style={{ width: `${clamped}%` }} />
      <span className="progress-bar__label">{clamped}%</span>
    </div>
  );
}
