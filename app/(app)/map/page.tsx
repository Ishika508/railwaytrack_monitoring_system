"use client";
import Link from "next/link";
import { ArrowRight, Map as MapIcon, Navigation } from "lucide-react";
import { JOURNEYS, nextStation } from "@/lib/journeys";
import { useStore } from "@/lib/store";
import { NetworkMap, RouteMap } from "@/components/RouteMap";
import { PageHeader, Progress } from "@/components/ui";
import { cn } from "@/lib/utils";

export default function MapPage() {
  const activeId = useStore((s) => s.activeId);
  const setActive = useStore((s) => s.setActive);
  const sims = useStore((s) => s.sims);
  const j = JOURNEYS.find((x) => x.id === activeId) ?? JOURNEYS[0];
  const sim = sims[j.id];
  const ns = nextStation(j, sim.km);
  return (
    <div>
      <PageHeader icon={MapIcon} title="Journey Map" sub="Schematic network view · click a route to inspect it" />
      <div className="grid gap-5 xl:grid-cols-[1.6fr_1fr]">
        <div className="space-y-5">
          <div className="card p-4"><NetworkMap selected={j.id} onSelect={setActive} className="w-full rounded-xl bg-surface2/40" /></div>
          <div className="card p-5">
            <div className="mb-2 flex items-center justify-between"><h2 className="card-title flex items-center gap-2"><Navigation className="h-4 w-4 text-primary" />{j.from} → {j.to}</h2><Link href={`/journeys/${j.id}`} className="btn-ghost btn-sm">Track journey<ArrowRight className="h-3.5 w-3.5" /></Link></div>
            <RouteMap journeyId={j.id} className="w-full rounded-xl bg-surface2/40" />
            <div className="mt-3 grid grid-cols-3 gap-3 text-center text-sm"><div className="rounded-xl bg-surface2 p-2.5"><div className="text-xs text-muted">Position</div><div className="font-bold">KM {sim.km.toFixed(1)}</div></div><div className="rounded-xl bg-surface2 p-2.5"><div className="text-xs text-muted">Next</div><div className="truncate font-bold">{ns.next.name}</div></div><div className="rounded-xl bg-surface2 p-2.5"><div className="text-xs text-muted">Speed</div><div className="font-bold">{sim.speed.toFixed(0)} km/h</div></div></div>
          </div>
        </div>
        <div className="card p-5">
          <h2 className="card-title mb-4">Routes</h2>
          <div className="space-y-2.5">
            {JOURNEYS.map((x) => (
              <button key={x.id} onClick={() => setActive(x.id)} className={cn("w-full rounded-xl border p-3.5 text-left transition", x.id === j.id ? "border-primary bg-primary/8" : "border-border hover:bg-surface2")}>
                <div className="flex items-center gap-2.5"><span className="h-3 w-3 rounded-full" style={{ background: x.color }} /><span className="flex-1 truncate font-semibold">{x.from} → {x.to}</span><span className="font-mono text-xs text-muted">{x.totalKm} km</span></div>
                <div className="mt-2.5"><Progress value={(sims[x.id].km / x.totalKm) * 100} color={x.color} /></div>
                <div className="mt-1.5 flex justify-between text-[11px] text-muted"><span>{x.train}</span><span>{sims[x.id].speed.toFixed(0)} km/h</span></div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
