"use client";
import { Area, AreaChart, CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { Sample } from "@/lib/types";
import { useColors } from "@/lib/hooks";

export interface Series { key: keyof Sample; color: string; name: string }

export function TipBox({ active, payload, label, unit = "" }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-border bg-surface px-3 py-2 text-xs shadow-xl">
      <div className="mb-1 font-semibold text-muted">{label === 0 ? "now" : `${label}s ago`}</div>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center gap-2"><span className="h-2 w-2 rounded-full" style={{ background: p.color }} /><span className="text-muted">{p.name}</span><span className="ml-auto font-semibold tabular-nums">{Number(p.value).toFixed(2)}{unit}</span></div>
      ))}
    </div>
  );
}

export function LiveChart({ history, series, height = 220, area = false, domain, refLine, unit, points = 60 }: { history: Sample[]; series: Series[]; height?: number; area?: boolean; domain?: [number | "auto", number | "auto"]; refLine?: { y: number; label: string }; unit?: string; points?: number }) {
  const c = useColors();
  const data = history.slice(-points).map((s, i, a) => ({ ...s, ago: a.length - 1 - i }));
  const Chart: any = area ? AreaChart : LineChart;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <Chart data={data} margin={{ top: 8, right: 8, left: -14, bottom: 0 }}>
        <defs>
          {series.map((s) => (
            <linearGradient key={s.key} id={`g-${s.key}`} x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor={s.color} stopOpacity=".35" /><stop offset="1" stopColor={s.color} stopOpacity="0" /></linearGradient>
          ))}
        </defs>
        <CartesianGrid stroke={c.grid} strokeDasharray="3 4" vertical={false} />
        <XAxis dataKey="ago" reversed tick={{ fill: c.text, fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(v) => (v === 0 ? "now" : `-${v}s`)} interval="preserveStartEnd" minTickGap={40} />
        <YAxis domain={domain ?? ["auto", "auto"]} tick={{ fill: c.text, fontSize: 11 }} tickLine={false} axisLine={false} width={54} tickFormatter={(v) => String(+Number(v).toFixed(2))} />
        <Tooltip content={<TipBox unit={unit} />} cursor={{ stroke: c.grid }} />
        {refLine && <ReferenceLine y={refLine.y} stroke={c.warn} strokeDasharray="5 5" label={{ value: refLine.label, fill: c.warn, fontSize: 10, position: "insideTopRight" }} />}
        {series.map((s) =>
          area ? (
            <Area key={s.key} type="monotone" dataKey={s.key} name={s.name} stroke={s.color} strokeWidth={2} fill={`url(#g-${s.key})`} isAnimationActive={false} dot={false} />
          ) : (
            <Line key={s.key} type="monotone" dataKey={s.key} name={s.name} stroke={s.color} strokeWidth={2} isAnimationActive={false} dot={false} />
          )
        )}
      </Chart>
    </ResponsiveContainer>
  );
}
