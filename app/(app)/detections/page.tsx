"use client";
import { useMemo, useState } from "react";
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ScanSearch } from "lucide-react";
import { useActive, useColors } from "@/lib/hooks";
import { DEFECTS, DEFECT_KEYS } from "@/lib/defects";
import { DEFECT_ICON, Empty, PageHeader, SeverityBadge } from "@/components/ui";
import { DefectThumb, seedOf } from "@/components/DefectThumb";
import { cn, fmtStamp } from "@/lib/utils";
import type { DefectType } from "@/lib/types";

export default function Detections() {
  const { journey: j, events } = useActive();
  const c = useColors();
  const [f, setF] = useState<DefectType | "all">("all");
  const visual = events.filter((e) => e.type !== "jerk" && e.type !== "orientation");
  const list = visual.filter((e) => f === "all" || e.type === f);
  const counts = useMemo(() => DEFECT_KEYS.filter((k) => k !== "jerk" && k !== "orientation").map((k) => ({ k, name: DEFECTS[k].short, n: visual.filter((e) => e.type === k).length, color: DEFECTS[k].color })), [visual.length]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div>
      <PageHeader icon={ScanSearch} title="Detections" sub={`${visual.length} defects captured on ${j.from} → ${j.to}`} />
      <div className="mb-5 grid gap-5 lg:grid-cols-[1fr_1.6fr]">
        <div className="card p-5">
          <h2 className="card-title mb-3">By defect type</h2>
          <ResponsiveContainer width="100%" height={190}>
            <BarChart data={counts} layout="vertical" margin={{ left: 4, right: 12 }}>
              <XAxis type="number" hide allowDecimals={false} />
              <YAxis type="category" dataKey="name" width={96} tick={{ fill: c.text, fontSize: 12 }} tickLine={false} axisLine={false} />
              <Tooltip cursor={{ fill: c.grid, opacity: 0.3 }} contentStyle={{ background: c.surface, border: `1px solid ${c.grid}`, borderRadius: 12, fontSize: 12 }} />
              <Bar dataKey="n" name="Detections" radius={6} isAnimationActive={false}>{counts.map((d) => <Cell key={d.k} fill={d.color} />)}</Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="card p-5">
          <h2 className="card-title mb-3">Filter</h2>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setF("all")} className={cn("chip border border-border px-3.5 py-2 text-xs", f === "all" ? "bg-primary text-white dark:text-[#0b1020]" : "bg-surface2 text-muted hover:text-ink")}>All ({visual.length})</button>
            {counts.map((d) => { const I = DEFECT_ICON[d.k]; return (
              <button key={d.k} onClick={() => setF(d.k)} className={cn("chip border border-border px-3.5 py-2 text-xs", f === d.k ? "bg-primary text-white dark:text-[#0b1020]" : "bg-surface2 text-muted hover:text-ink")}><I className="h-3.5 w-3.5" />{d.name} ({d.n})</button>
            ); })}
          </div>
          <p className="mt-4 text-xs text-muted">Snapshots are rendered from the simulator. With the Radxa connected, saved frames appear here.</p>
        </div>
      </div>
      {list.length === 0 ? <div className="card"><Empty icon={ScanSearch} title="No detections yet" sub="Defects will appear here as the train moves along the track." /></div> : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {list.slice(0, 48).map((e) => (
            <div key={e.id} className="card group overflow-hidden transition hover:-translate-y-0.5 hover:border-primary/40">
              <div className="aspect-[16/10] overflow-hidden"><DefectThumb type={e.type} seed={seedOf(e.id)} conf={e.confidence} /></div>
              <div className="p-4">
                <div className="flex items-start justify-between gap-2"><div className="font-semibold">{DEFECTS[e.type].label}</div><SeverityBadge sev={e.severity} /></div>
                <div className="mt-2 grid grid-cols-3 gap-2 text-xs"><div><div className="text-muted">Confidence</div><div className="font-semibold">{Math.round(e.confidence * 100)}%</div></div><div><div className="text-muted">Location</div><div className="font-mono font-semibold">KM {e.km.toFixed(1)}</div></div><div><div className="text-muted">Status</div><div className="font-semibold capitalize">{e.status === "ack" ? "Acknowledged" : e.status}</div></div></div>
                <div className="mt-2 font-mono text-[11px] text-muted">{fmtStamp(e.ts)}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
