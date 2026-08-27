import { useState } from "react";

interface LineDatum {
  label: string;
  value: number;
}

// Coordenadas fijas en unidades de viewBox, no en píxeles reales — el SVG escala como un
// bloque uniforme (mismo factor en X e Y) porque el contenedor fija el ancho y deja la altura
// en "auto": el navegador la calcula a partir de esta relación de aspecto (600:110), así que
// las etiquetas de mes escalan igual que las líneas y nunca salen estiradas. Antes se forzaba
// un alto en px distinto de la proporción del viewBox junto con preserveAspectRatio="none",
// que estira X e Y por separado — de ahí el texto deformado.
// Ancho fijo (600, no cambia el hueco horizontal que ocupa); alto cada vez más compacto — de
// 220 a 140 y ahora a 110 — solo reduce el espacio vertical, el tamaño del texto no cambia
// (la escala px-por-unidad depende solo de WIDTH, que no se toca).
const WIDTH = 600;
const HEIGHT = 110;
const PADDING = { top: 14, right: 24, bottom: 22, left: 24 };

/**
 * Gráfico de línea minimalista en SVG puro (sin dependencias externas), con crosshair +
 * tooltip al pasar el ratón — ver skill de dataviz: un gráfico de línea es interactivo por
 * defecto, no una mejora opcional. Los puntos se colorean por signo (positivo/negativo),
 * igual que el resto de la app (SummaryCard, tarjetas de saldo) para que un vistazo baste.
 */
export function MiniLineChart({
  data,
  formatValue = (v: number) => String(v),
}: {
  data: LineDatum[];
  formatValue?: (value: number) => string;
}) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  if (data.length === 0) return null;

  const plotWidth = WIDTH - PADDING.left - PADDING.right;
  const plotHeight = HEIGHT - PADDING.top - PADDING.bottom;

  // El dominio SIEMPRE incluye el cero (min(0, ...) / max(0, ...)): así la línea base es
  // significativa y visible incluso si todos los valores son del mismo signo, en vez de
  // desperdiciar la mitad del alto con un rango simétrico ±max que no hace falta.
  const minValue = Math.min(0, ...data.map((d) => d.value));
  const maxValue = Math.max(0, ...data.map((d) => d.value));
  const range = maxValue - minValue || 1;

  const xStep = data.length > 1 ? plotWidth / (data.length - 1) : 0;
  const xAt = (i: number) => PADDING.left + i * xStep;
  const yAt = (v: number) => PADDING.top + plotHeight - ((v - minValue) / range) * plotHeight;
  const zeroY = yAt(0);

  const points = data.map((d, i) => ({ ...d, x: xAt(i), y: yAt(d.value) }));
  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
  const hovered = hoverIndex !== null ? points[hoverIndex] : null;

  const snapToNearest = (clientX: number, currentTarget: SVGSVGElement) => {
    const rect = currentTarget.getBoundingClientRect();
    const relX = ((clientX - rect.left) / rect.width) * WIDTH;
    let nearest = 0;
    let nearestDist = Infinity;
    points.forEach((p, i) => {
      const dist = Math.abs(p.x - relX);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = i;
      }
    });
    setHoverIndex(nearest);
  };

  return (
    <div className="relative w-full">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="block h-auto w-full overflow-visible"
        role="img"
        aria-label={`Tendencia por mes: ${data.map((d) => `${d.label} ${formatValue(d.value)}`).join(", ")}`}
        onPointerMove={(e) => snapToNearest(e.clientX, e.currentTarget)}
        onPointerLeave={() => setHoverIndex(null)}
      >
        {/* Línea base cero — hairline recesiva, nunca discontinua (ver marks-and-anatomy). */}
        <line x1={PADDING.left} y1={zeroY} x2={WIDTH - PADDING.right} y2={zeroY} stroke="var(--border)" strokeWidth={1} />
        <text x={PADDING.left - 6} y={zeroY} dy={3} fontSize={11} textAnchor="end" fill="var(--muted-foreground)">
          0
        </text>

        {/* Crosshair: encuentra la X, no hace falta acertar sobre la línea. */}
        {hovered && (
          <line x1={hovered.x} y1={PADDING.top} x2={hovered.x} y2={HEIGHT - PADDING.bottom} stroke="var(--border)" strokeWidth={1} />
        )}

        <path d={linePath} fill="none" stroke="var(--primary)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

        {points.map((p, i) => (
          <circle
            key={p.label}
            cx={p.x}
            cy={p.y}
            r={hoverIndex === i ? 6 : 4}
            fill={p.value >= 0 ? "var(--positive)" : "var(--negative)"}
            stroke="var(--card)"
            strokeWidth={2}
            className="transition-[r]"
          />
        ))}

        {/* Valor en el extremo (última barra) — la única etiqueta directa; el resto vive en
            el tooltip al pasar el ratón, nunca un número en cada punto (ver marks-and-anatomy). */}
        <text
          x={points[points.length - 1].x}
          y={points[points.length - 1].y - 12}
          fontSize={12}
          fontWeight={600}
          textAnchor="end"
          fill="var(--foreground)"
        >
          {formatValue(points[points.length - 1].value)}
        </text>

        {points.map((p) => (
          <text key={p.label} x={p.x} y={HEIGHT - 8} fontSize={13} textAnchor="middle" fill="var(--muted-foreground)">
            {p.label}
          </text>
        ))}
      </svg>

      {hovered && (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-[calc(100%+10px)] whitespace-nowrap rounded-xl border border-border bg-card px-3 py-2 text-xs shadow-[var(--shadow-soft)]"
          style={{ left: `${(hovered.x / WIDTH) * 100}%`, top: `${(hovered.y / HEIGHT) * 100}%` }}
        >
          <p className={`font-semibold ${hovered.value >= 0 ? "text-primary" : "text-destructive"}`}>{formatValue(hovered.value)}</p>
          <p className="text-muted-foreground">{hovered.label}</p>
        </div>
      )}
    </div>
  );
}
