"use client";

/** A radial progress gauge (donut) rendered with inline SVG. value is 0..1. */
export function RadialGauge({
  value,
  size = 180,
  stroke = 16,
  centerTop,
  centerBottom,
  trackClass = "text-slate-100",
  valueClass = "text-brand-600",
}: {
  value: number;
  size?: number;
  stroke?: number;
  centerTop?: string;
  centerBottom?: string;
  trackClass?: string;
  valueClass?: string;
}) {
  const clamped = Math.max(0, Math.min(1, value));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - clamped);

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          className={trackClass}
          stroke="currentColor"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          className={valueClass}
          stroke="currentColor"
          strokeDasharray={c}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 700ms ease" }}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        {centerTop && (
          <span className="text-2xl font-bold text-slate-900">{centerTop}</span>
        )}
        {centerBottom && (
          <span className="mt-0.5 text-xs text-slate-500">{centerBottom}</span>
        )}
      </div>
    </div>
  );
}

/** Simple horizontal bar (value relative to max). */
export function Bar({
  label,
  value,
  max,
  format,
}: {
  label: string;
  value: number;
  max: number;
  format: (n: number) => string;
}) {
  const pct = max > 0 ? Math.max(2, (value / max) * 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="truncate pr-2 text-slate-700">{label}</span>
        <span className="tabular-nums font-medium text-slate-900">
          {format(value)}
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-brand-600 transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
