"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowRight, Cpu, Gauge, MapPin, Plus, Route as RouteIcon, ShieldCheck, TrainFront } from "lucide-react";
import { JOURNEYS, nextStation } from "@/lib/journeys";
import { useStore } from "@/lib/store";
import { healthScore } from "@/lib/sim";
import { PageHeader, Progress, Tile } from "@/components/ui";
import { TrackFeed } from "@/components/TrackCanvas";
import { RingGauge } from "@/components/Spark";
import { cn } from "@/lib/utils";

export default function Journeys() {
  const sims = useStore((s) => s.sims);
  const events = useStore((s) => s.events);
  const setActive = useStore((s) => s.setActive);
  const op = useStore((s) => s.operator);
  const router = useRouter();
  const open = events.filter((e) => e.status === "open").length;
  const avg = JOURNEYS.reduce((a, j) => a + sims[j.id].speed, 0) / JOURNEYS.length;
  const km = JOURNEYS.reduce((a, j) => a + sims[j.id].km, 0);

  return (
    <div>
      <PageHeader icon={TrainFront} title={`Welcome, ${op?.name.split(" ")[0] ?? "Operator"}`} sub="Live top-view inspection feeds for every active journey. Select one to track it end to end."
        actions={<Link href="/connect" className="btn-ghost"><Cpu className="h-4 w-4" />Hardware</Link>} />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Tile icon={TrainFront} label="Active journeys" value={JOURNEYS.length} sub="All feeds live" tone="primary" />
        <Tile icon={MapPin} label="Distance covered" value={`${km.toFixed(0)} km`} sub="Across all journeys" tone="accent" />
        <Tile icon={Gauge} label="Average speed" value={`${avg.toFixed(0)} km/h`} sub="Fleet average" tone="info" />
        <Tile icon={AlertTriangle} label="Open alerts" value={open} sub={open ? "Needs attention" : "All clear"} tone={open ? "warn" : "ok"} />
      </div>

      <div className="grid gap-5 md:grid-cols-2 2xl:grid-cols-3">
        {JOURNEYS.map((j, i) => {
          const sim = sims[j.id];
          const ns = nextStation(j, sim.km);
          const mine = events.filter((e) => e.journeyId === j.id);
          const alerts = mine.filter((e) => e.status === "open").length;
          const hs = healthScore(events, j.id, sim.km);
          const pct = (sim.km / j.totalKm) * 100;
          return (
            <div key={j.id} role="link" tabIndex={0} onClick={() => { setActive(j.id); router.push(`/journeys/${j.id}`); }}
              onKeyDown={(e) => { if (e.key === "Enter") { setActive(j.id); router.push(`/journeys/${j.id}`); } }}
              className="card group cursor-pointer overflow-hidden transition duration-300 hover:-translate-y-1 hover:border-primary/50 hover:shadow-2xl animate-fade-up" style={{ animationDelay: `${i * 70}ms` }}>
              <div className="relative">
                <TrackFeed journeyId={j.id} compact className="aspect-[16/9] !rounded-none" />
                <div className="absolute inset-x-0 bottom-9 flex justify-end px-3">
                  {alerts > 0 && <span className="chip bg-bad text-white shadow-lg"><AlertTriangle className="h-3 w-3" />{alerts} open</span>}
                </div>
              </div>
              <div className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-lg font-bold tracking-tight"><span className="truncate">{j.from}</span><ArrowRight className="h-4 w-4 shrink-0 text-muted" /><span className="truncate">{j.to}</span></div>
                    <div className="mt-0.5 text-xs text-muted">{j.train} · {j.trainNo}</div>
                  </div>
                  <RingGauge value={hs} max={100} size={56} color={hs > 85 ? "rgb(var(--ok))" : hs > 65 ? "rgb(var(--warn))" : "rgb(var(--bad))"} unit="" />
                </div>
                <div className="mt-4">
                  <div className="mb-1.5 flex justify-between text-xs"><span className="font-mono text-muted">KM {sim.km.toFixed(0)} / {j.totalKm}</span><span className="font-semibold">{pct.toFixed(0)}%</span></div>
                  <Progress value={pct} color={j.color} />
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
                  <div className="rounded-xl bg-surface2 p-2.5"><div className="text-muted">Speed</div><div className="mt-0.5 font-bold tabular-nums">{sim.speed.toFixed(0)} km/h</div></div>
                  <div className="col-span-2 rounded-xl bg-surface2 p-2.5"><div className="text-muted">Next station</div><div className="mt-0.5 truncate font-bold">{ns.next.name} <span className="font-medium text-muted">· {Math.max(0, ns.next.km - sim.km).toFixed(0)} km</span></div></div>
                </div>
                <div className="mt-4 flex items-center justify-between text-sm font-semibold text-primary">
                  <span className="flex items-center gap-1.5"><RouteIcon className="h-4 w-4" />Track journey</span>
                  <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
                </div>
              </div>
            </div>
          );
        })}
        <Link href="/connect" className={cn("card grid min-h-[300px] place-items-center border-dashed p-8 text-center transition hover:border-primary/50 hover:bg-surface2")}>
          <div>
            <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-primary/12 text-primary"><Plus className="h-6 w-6" /></div>
            <div className="font-semibold">Connect a live device</div>
            <p className="mx-auto mt-1 max-w-[230px] text-xs text-muted">Link a Radxa to stream the real top-view camera and IMU into the active journey.</p>
            <span className="chip mt-3 bg-ok/12 text-ok"><ShieldCheck className="h-3 w-3" />Simulator running</span>
          </div>
        </Link>
      </div>
    </div>
  );
}
