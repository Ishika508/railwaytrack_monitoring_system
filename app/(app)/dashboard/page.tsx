"use client";
import Link from "next/link";
import { useMemo } from "react";
import { Bell, Clock, FileVideo, LayoutDashboard, MapPin, Navigation, Upload } from "lucide-react";
import { useActive, useColors } from "@/lib/hooks";
import { DEFECTS, SEV_ORDER } from "@/lib/defects";
import { PageHeader, Progress, SeverityBadge, Tile } from "@/components/ui";
import { TrackFeed } from "@/components/TrackCanvas";
import { SensorCards } from "@/components/SensorCards";
import { ConditionBar } from "@/components/ConditionBar";
import { LiveChart } from "@/components/Charts";
import { AlertRow } from "@/components/AlertList";
import { DefectThumb, seedOf } from "@/components/DefectThumb";
import { fmtTime, fmtStamp } from "@/lib/utils";

export default function Dashboard() {
  const { journey: j, sim, events, next, remaining, toEnd, pct } = useActive();
  const c = useColors();
  const etaMs = Date.now() + (toEnd / Math.max(sim.speed, 1)) * 3600 * 1000;
  const featured = useMemo(() => events.filter((e) => e.type !== "jerk").sort((a, b) => SEV_ORDER[b.severity] - SEV_ORDER[a.severity] || b.ts - a.ts)[0], [events.length]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div>
      <PageHeader icon={LayoutDashboard} title="Dashboard" sub={`${j.from} → ${j.to} · ${j.train}`} />
      <div className="grid gap-5 xl:grid-cols-[1.5fr_1fr]">
        <div className="card flex flex-col p-3"><TrackFeed journeyId={j.id} controls className="min-h-[300px] w-full flex-1" /></div>
        <div className="card p-5"><h2 className="card-title mb-4">Sensor readings</h2><SensorCards /></div>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-3">
        <Tile icon={MapPin} label="Total distance" value={`${sim.km.toFixed(1)} km`} sub={`of ${j.totalKm} km · ${pct.toFixed(0)}%`} tone="ok"><Progress className="mt-3" value={pct} /></Tile>
        <Tile icon={Navigation} label="Next station" value={next.name} sub={`${remaining.toFixed(0)} km · ${((remaining / Math.max(sim.speed, 1)) * 60).toFixed(0)} min`} tone="info" />
        <Tile icon={Clock} label="Estimated arrival" value={fmtTime(etaMs)} sub={sim.speed > j.cruise * 0.7 ? "On time" : "Slight delay"} tone="primary" />
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1.1fr_1.1fr_1fr]">
        <div className="card p-5">
          <h2 className="card-title mb-4">Detection result</h2>
          {featured ? (
            <div className="flex flex-col gap-4 sm:flex-row">
              <div className="aspect-[4/3] w-full overflow-hidden rounded-xl sm:w-44 sm:shrink-0"><DefectThumb key={featured.id} type={featured.type} seed={seedOf(featured.id)} conf={featured.confidence} /></div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2"><span className="font-semibold">{DEFECTS[featured.type].label}</span><SeverityBadge sev={featured.severity} /></div>
                <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
                  <dt className="text-muted">Confidence</dt><dd className="font-medium">{Math.round(featured.confidence * 100)}%</dd>
                  <dt className="text-muted">Location</dt><dd className="font-mono font-medium">KM {featured.km.toFixed(1)}</dd>
                  <dt className="text-muted">Timestamp</dt><dd className="font-mono text-xs font-medium">{fmtStamp(featured.ts)}</dd>
                </dl>
                <p className="mt-3 rounded-lg bg-surface2 p-2.5 text-xs text-muted">{DEFECTS[featured.type].action}</p>
                <Link href="/map" className="btn-ghost btn-sm mt-3 w-full"><MapPin className="h-3.5 w-3.5" />View on map</Link>
              </div>
            </div>
          ) : <p className="py-10 text-center text-sm text-muted">Waiting for first detection…</p>}
        </div>

        <div className="card p-5">
          <h2 className="card-title mb-4">Track condition <span className="font-normal text-muted">(last 50 km)</span></h2>
          <ConditionBar />
          <div className="mt-4"><LiveChart history={sim.history} area height={150} series={[{ key: "vib", color: c.info, name: "Vibration (g)" }, { key: "ax", color: c.warn, name: "Acceleration (m/s²)" }]} /></div>
        </div>

        <div className="space-y-5">
          <div className="card p-5">
            <div className="mb-3 flex items-center justify-between"><h2 className="card-title flex items-center gap-2"><Bell className="h-4 w-4 text-primary" />Active alerts</h2><Link href="/alerts" className="btn-ghost btn-sm">View all</Link></div>
            <div className="space-y-2">{events.filter((e) => e.status === "open").slice(0, 4).map((e) => <AlertRow key={e.id} e={e} />)}{!events.some((e) => e.status === "open") && <p className="py-6 text-center text-sm text-muted">No active alerts.</p>}</div>
          </div>
          <Link href="/video-analysis" className="card group flex items-center gap-4 p-5 transition hover:border-primary/50">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-primary/12 text-primary"><Upload className="h-6 w-6" /></div>
            <div className="flex-1"><div className="font-semibold">Video analysis</div><div className="text-xs text-muted">Upload recorded track video and test the model</div></div>
            <FileVideo className="h-5 w-5 text-muted transition group-hover:text-primary" />
          </Link>
        </div>
      </div>
    </div>
  );
}
