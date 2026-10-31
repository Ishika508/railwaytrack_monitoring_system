"use client";
import { useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Activity, ArrowLeft, ArrowRight, Clock, Flag, Gauge, LayoutDashboard, MapPin, Navigation, Route as RouteIcon, TrainFront } from "lucide-react";
import { useStore } from "@/lib/store";
import { useActive, useColors } from "@/lib/hooks";
import { DEFECTS } from "@/lib/defects";
import { PageHeader, Progress, Tile } from "@/components/ui";
import { TrackFeed } from "@/components/TrackCanvas";
import { FloatingSensors } from "@/components/FloatingSensors";
import { RouteMap } from "@/components/RouteMap";
import { AlertRow } from "@/components/AlertList";
import { ConditionBar } from "@/components/ConditionBar";
import { LiveChart } from "@/components/Charts";
import { cn, fmtTime } from "@/lib/utils";
import { JOURNEYS } from "@/lib/journeys";

export default function JourneyDetail() {
  const { id } = useParams<{ id: string }>();
  const setActive = useStore((s) => s.setActive);
  const jid = JOURNEYS.some((j) => j.id === id) ? id : JOURNEYS[0].id;
  useEffect(() => setActive(jid), [jid, setActive]);
  const { journey: j, sim, events, next, remaining, toEnd, pct } = useActive(jid);
  const c = useColors();
  const etaMs = Date.now() + (toEnd / Math.max(sim.speed, 1)) * 3600 * 1000;

  return (
    <div>
      <PageHeader icon={RouteIcon} title={`${j.from} → ${j.to}`} sub={`${j.train} · Train ${j.trainNo} · ${j.totalKm} km route`}
        actions={<><Link href="/journeys" className="btn-ghost"><ArrowLeft className="h-4 w-4" />All journeys</Link><Link href="/dashboard" className="btn-primary"><LayoutDashboard className="h-4 w-4" />Full dashboard</Link></>} />

      <div className="grid gap-5 xl:grid-cols-[1.65fr_1fr]">
        <div className="space-y-5">
          <div className="card p-3">
            <TrackFeed journeyId={j.id} controls className="aspect-[16/8.5] w-full">
              <FloatingSensors journeyId={j.id} />
            </TrackFeed>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <Tile icon={Gauge} label="Current speed" value={`${sim.speed.toFixed(0)} km/h`} tone="info" />
            <Tile icon={MapPin} label="Location" value={`KM ${sim.km.toFixed(1)}`} sub={`of ${j.totalKm} km`} tone="primary" />
            <Tile icon={Clock} label="Estimated arrival" value={fmtTime(etaMs)} sub={`${toEnd.toFixed(0)} km to ${j.to}`} tone="ok" />
          </div>

          <div className="card p-5">
            <div className="mb-3 flex items-center justify-between"><h2 className="card-title flex items-center gap-2"><Activity className="h-4 w-4 text-primary" />Vibration & acceleration</h2><span className="chip bg-ok/12 text-ok">Live</span></div>
            <LiveChart history={sim.history} area series={[{ key: "vib", color: c.warn, name: "Vibration (g)" }, { key: "ax", color: c.info, name: "Accel X (m/s²)" }]} height={190} unit="" />
          </div>
        </div>

        <div className="space-y-5">
          <div className="card p-5">
            <div className="mb-2 flex items-center justify-between"><h2 className="card-title flex items-center gap-2"><Navigation className="h-4 w-4 text-primary" />Route tracking</h2><span className="font-mono text-xs text-muted">{pct.toFixed(1)}%</span></div>
            <RouteMap journeyId={j.id} className="w-full rounded-xl bg-surface2/50" />
          </div>

          <div className="card p-5">
            <h2 className="card-title mb-4 flex items-center gap-2"><Flag className="h-4 w-4 text-primary" />Station timeline</h2>
            <ol className="relative space-y-0">
              {j.stations.map((s, i) => {
                const passed = s.km <= sim.km, isNext = s.name === next.name && !passed;
                return (
                  <li key={s.name} className="relative flex gap-4 pb-5 last:pb-0">
                    {i < j.stations.length - 1 && <span className="absolute left-[9px] top-5 h-full w-0.5" style={{ background: s.km < sim.km && j.stations[i + 1].km <= sim.km ? j.color : "rgb(var(--border))" }} />}
                    <span className={cn("z-10 mt-0.5 h-5 w-5 shrink-0 rounded-full border-[3px] bg-surface", isNext && "animate-pulse")} style={{ borderColor: passed || isNext ? j.color : "rgb(var(--border))", background: passed ? j.color : undefined }} />
                    <div className="flex flex-1 items-baseline justify-between gap-2">
                      <div><div className={cn("text-sm font-semibold", !passed && !isNext && "text-muted")}>{s.name}</div>{isNext && <div className="text-xs font-medium" style={{ color: j.color }}>Next · {remaining.toFixed(0)} km · {((remaining / Math.max(sim.speed, 1)) * 60).toFixed(0)} min</div>}</div>
                      <span className="font-mono text-xs text-muted">KM {s.km}</span>
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>
        </div>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1fr_1.65fr]">
        <div className="card p-5"><h2 className="card-title mb-4">Track condition · last 50 km</h2><ConditionBar journeyId={j.id} /></div>
        <div className="card p-5">
          <div className="mb-4 flex items-center justify-between"><h2 className="card-title">Journey log</h2><Link href="/alerts" className="flex items-center gap-1 text-xs font-semibold text-primary">View all<ArrowRight className="h-3 w-3" /></Link></div>
          <div className="mb-4">
            <div className="relative h-2.5 rounded-full bg-surface2">
              <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${pct}%`, background: j.color }} />
              {events.filter((e) => e.type !== "jerk").slice(0, 30).map((e) => <span key={e.id} title={`${DEFECTS[e.type].label} · KM ${e.km}`} className="absolute top-1/2 h-3.5 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ left: `${(e.km / j.totalKm) * 100}%`, background: DEFECTS[e.type].color }} />)}
            </div>
            <div className="mt-1.5 flex justify-between text-[11px] text-muted"><span>{j.from}</span><span>Defects marked along route</span><span>{j.to}</span></div>
          </div>
          <div className="space-y-2">
            {events.slice(0, 4).map((e) => <AlertRow key={e.id} e={e} />)}
            {events.length === 0 && <p className="py-6 text-center text-sm text-muted">No defects yet on this journey. Monitoring continues.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
