interface BarDatum {
  label: string;
  value: number;
}

/** Gráfico de barras minimalista en SVG puro, sin dependencias externas (Recharts, etc.). */
export function MiniBarChart({ data, height = 120 }: { data: BarDatum[]; height?: number }) {
  const max = Math.max(1, ...data.map((d) => Math.abs(d.value)));
  const barWidth = 100 / data.length;

  return (
    <svg viewBox={`0 0 100 ${height}`} className="h-[120px] w-full text-muted-foreground" preserveAspectRatio="none">
      {data.map((d, i) => {
        const barHeight = (Math.abs(d.value) / max) * (height - 24);
        const x = i * barWidth + barWidth * 0.15;
        const width = barWidth * 0.7;
        const y = d.value >= 0 ? height - 20 - barHeight : height - 20;
        return (
          <g key={d.label}>
            <rect
              x={x}
              y={y}
              width={width}
              height={Math.max(1, barHeight)}
              fill={d.value >= 0 ? "var(--positive)" : "var(--negative)"}
              rx={1}
            />
            <text x={x + width / 2} y={height - 6} fontSize="6" textAnchor="middle" fill="currentColor">
              {d.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
