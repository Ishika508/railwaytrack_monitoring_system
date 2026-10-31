"use client";
import { useMemo, useState } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AlertTriangle, BarChart3, Download, Printer, ScanSearch, ShieldCheck, Target } from "lucide-react";
import { JOURNEYS, getJourney } from "@/lib/journeys";
import { useStore } from "@/lib/store";
import { useColors } from "@/lib/hooks";
import { DEFECTS, DEFECT_KEYS } from "@/lib/defects";
import { healthScore } from "@/lib/sim";
import { PageHeader, Tile } from "@/components/ui";
import { downloadText, fmtDate, fmtStamp } from "@/lib/utils";

export default function Reports() {
  const events = useStore((s) => s.events);
  const sims = useStore((s) => s.sims);
  const op = useStore((s) => s.operator);
  const activeId = useStore((s) => s.activeId);
  const c = useColors();
  const [scope, setScope] = useState<string>("all");
  const list = scope === "all" ? events : events.filter((e) => e.journeyId === scope);
  const j = scope === "all" ? null : getJourney(scope);
  const byType = DEFECT_KEYS.map((k) => ({ name: DEFECTS[k].short, n: list.filter((e) => e.type === k).length, color: DEFECTS[k].color }));
  const sevs = (["low", "medium", "high", "critical"] as const).map((s) => ({ name: s, n: list.filter((e) => e.severity === s).length, color: { low: c.info, medium: c.warn, high: c.bad, critical: "#b91c1c" }[s] }));
  const avgConf = list.length ? list.reduce((a, e) => a + e.confidence, 0) / list.length : 0;
  const high = list.filter((e) => e.severity === "high" || e.severity === "critical").length;
  const health = scope === "all" ? Math.round(JOURNEYS.reduce((a, x) => a + healthScore(events, x.id, sims[x.id].km), 0) / JOURNEYS.length) : healthScore(events, scope, sims[scope].km);
  const bins = useMemo(() => {
    const total = j ? j.totalKm : 100;
    const step = Math.max(10, Math.round(total / 12 / 10) * 10);
    const n = Math.ceil(total / step);
    const arr = Array.from({ length: n }, (_, i) => ({ km: `${i * step}`, n: 0 }));
    for (const e of list) if (j) arr[Math.min(n - 1, Math.floor(e.km / step))].n++;
    return arr;
  }, [list.length, scope]); // eslint-disable-line react-hooks/exhaustive-deps

  const exportCsv = () => downloadText(`trackguard-report-${scope}.csv`, "id,journey,defect,severity,confidence,km,timestamp,status\n" + list.map((e) => `${e.id},${getJourney(e.journeyId).from}-${getJourney(e.journeyId).to},${DEFECTS[e.type].label},${e.severity},${e.confidence},${e.km},${fmtStamp(e.ts)},${e.status}`).join("\n"));
  const tip = { background: c.surface, border: `1px solid ${c.grid}`, borderRadius: 12, fontSize: 12 };

  return (
    <div>
      <PageHeader icon={BarChart3} title="Reports" sub={`Inspection summary · ${fmtDate(Date.now())} · Operator ${op?.name ?? "-"}`}
        actions={<>
          <select className="input !w-auto" value={scope} onChange={(e) => setScope(e.target.value)} aria-label="Report scope"><option value="all">All journeys</option>{JOURNEYS.map((x) => <option key={x.id} value={x.id}>{x.from} → {x.to}</option>)}</select>
          <button className="btn-ghost no-print" onClick={exportCsv}><Download className="h-4 w-4" />CSV</button>
          <button className="btn-primary no-print" onClick={() => window.print()}><Printer className="h-4 w-4" />Print / PDF</button>
        </>} />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Tile icon={ScanSearch} label="Total detections" value={list.length} tone="primary" />
        <Tile icon={AlertTriangle} label="High / critical" value={high} tone={high ? "bad" : "ok"} />
        <Tile icon={Target} label="Avg. confidence" value={`${Math.round(avgConf * 100)}%`} tone="info" />
        <Tile icon={ShieldCheck} label="Track health score" value={`${health}/100`} tone={health > 85 ? "ok" : health > 65 ? "warn" : "bad"} />
      </div>
      <div className="mt-5 grid gap-5 xl:grid-cols-[1.4fr_1fr]">
        <div className="card p-5">
          <h2 className="card-title mb-3">Detections by type</h2>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={byType} margin={{ left: -18, right: 8 }}>
              <CartesianGrid stroke={c.grid} strokeDasharray="3 4" vertical={false} />
              <XAxis dataKey="name" tick={{ fill: c.text, fontSize: 11 }} tickLine={false} axisLine={false} interval={0} />
              <YAxis allowDecimals={false} tick={{ fill: c.text, fontSize: 11 }} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={tip} cursor={{ fill: c.grid, opacity: 0.3 }} />
              <Bar dataKey="n" name="Count" radius={[8, 8, 0, 0]} isAnimationActive={false}>{byType.map((d) => <Cell key={d.name} fill={d.color} />)}</Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="card p-5">
          <h2 className="card-title mb-3">Severity split</h2>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart><Pie data={sevs} dataKey="n" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={3} stroke="none" isAnimationActive={false}>{sevs.map((d) => <Cell key={d.name} fill={d.color} />)}</Pie><Tooltip contentStyle={tip} /></PieChart>
          </ResponsiveContainer>
          <div className="mt-1 flex flex-wrap justify-center gap-3 text-xs">{sevs.map((s) => <span key={s.name} className="flex items-center gap-1.5 capitalize"><span className="h-2.5 w-2.5 rounded-full" style={{ background: s.color }} />{s.name} ({s.n})</span>)}</div>
        </div>
      </div>
      {j && (
        <div className="card mt-5 p-5">
          <h2 className="card-title mb-3">Defect density along route (per {bins.length > 1 ? Number(bins[1].km) : 10} km)</h2>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={bins} margin={{ left: -18, right: 8 }}>
              <defs><linearGradient id="dens" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor={c.primary} stopOpacity=".4" /><stop offset="1" stopColor={c.primary} stopOpacity="0" /></linearGradient></defs>
              <CartesianGrid stroke={c.grid} strokeDasharray="3 4" vertical={false} />
              <XAxis dataKey="km" tick={{ fill: c.text, fontSize: 11 }} tickLine={false} axisLine={false} unit=" km" />
              <YAxis allowDecimals={false} tick={{ fill: c.text, fontSize: 11 }} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={tip} />
              <Area type="monotone" dataKey="n" name="Defects" stroke={c.primary} strokeWidth={2} fill="url(#dens)" isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
      <div className="card mt-5 overflow-hidden">
        <div className="p-5 pb-3"><h2 className="card-title">Journey summary</h2></div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-y border-border bg-surface2/60 text-left text-xs uppercase tracking-wider text-muted"><th className="px-5 py-3">Journey</th><th className="px-3 py-3">Train</th><th className="px-3 py-3">Progress</th><th className="px-3 py-3">Detections</th><th className="px-3 py-3">Open alerts</th><th className="px-5 py-3 text-right">Health</th></tr></thead>
            <tbody>{JOURNEYS.map((x) => { const m = events.filter((e) => e.journeyId === x.id); const h = healthScore(events, x.id, sims[x.id].km); return (
              <tr key={x.id} className={`border-b border-border last:border-0 ${x.id === activeId ? "bg-primary/5" : ""}`}>
                <td className="px-5 py-3 font-semibold">{x.from} → {x.to}</td><td className="px-3 py-3 text-muted">{x.train}</td><td className="px-3 py-3 font-mono text-xs">{((sims[x.id].km / x.totalKm) * 100).toFixed(0)}%</td><td className="px-3 py-3 tabular-nums">{m.length}</td><td className="px-3 py-3 tabular-nums">{m.filter((e) => e.status === "open").length}</td>
                <td className="px-5 py-3 text-right"><span className={`chip ${h > 85 ? "bg-ok/12 text-ok" : h > 65 ? "bg-warn/15 text-warn" : "bg-bad/12 text-bad"}`}>{h}</span></td></tr>
            ); })}</tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
