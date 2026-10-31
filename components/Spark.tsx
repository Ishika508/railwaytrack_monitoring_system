"use client";
import { useId } from "react";

export function Spark({ data, color, h = 36, fill = true, className = "" }: { data: number[]; color: string; h?: number; fill?: boolean; className?: string }) {
  const id = useId().replace(/:/g, "");
  const w = 120;
  if (data.length < 2) return <div style={{ height: h }} />;
  const min = Math.min(...data), max = Math.max(...data), rng = max - min || 1;
  const pts = data.map((v, i) => [(i / (data.length - 1)) * w, h - 3 - ((v - min) / rng) * (h - 6)]);
  const d = pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className={`w-full ${className}`} style={{ height: h }}>
      <defs>
        <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor={color} stopOpacity=".35" /><stop offset="1" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {fill && <path d={`${d} L${w} ${h} L0 ${h} Z`} fill={`url(#${id})`} />}
      <path d={d} fill="none" stroke={color} strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export function RingGauge({ value, max, color, size = 88, label, unit }: { value: number; max: number; color: string; size?: number; label?: string; unit?: string }) {
  const r = size / 2 - 7, c = 2 * Math.PI * r, p = Math.min(value / max, 1);
  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgb(var(--border))" strokeWidth="7" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth="7" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - p)} style={{ transition: "stroke-dashoffset .6s ease" }} />
      </svg>
      <div className="absolute text-center leading-tight">
        <div className={size < 70 ? "text-sm font-bold tabular-nums" : "text-lg font-bold tabular-nums"}>{label ?? value.toFixed(0)}</div>
        {unit && <div className="text-[10px] font-medium text-muted">{unit}</div>}
      </div>
    </div>
  );
}
