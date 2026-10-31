"use client";
import { Camera, Radio, ScanSearch } from "lucide-react";
import { useActive } from "@/lib/hooks";
import { useStore } from "@/lib/store";
import { DEFECTS } from "@/lib/defects";
import { PageHeader, Toggle } from "@/components/ui";
import { TrackFeed } from "@/components/TrackCanvas";
import { FloatingSensors } from "@/components/FloatingSensors";
import { DEFECT_ICON } from "@/components/ui";
import { ago } from "@/lib/utils";
import { useNow } from "@/lib/hooks";
import { cn } from "@/lib/utils";

export default function Live() {
  const { journey: j, sim, events } = useActive();
  const overlay = useStore((s) => s.prefs.overlay);
  const setPrefs = useStore((s) => s.setPrefs);
  const now = useNow(1000);
  return (
    <div>
      <PageHeader icon={Radio} title="Live Monitoring" sub={`${j.from} → ${j.to} · ${j.train}`}
        actions={<label className="flex items-center gap-3 rounded-xl border border-border bg-surface px-4 py-2.5 text-sm font-medium"><ScanSearch className="h-4 w-4 text-primary" />AI overlay<Toggle on={overlay} onChange={(v) => setPrefs({ overlay: v })} label="AI overlay" /></label>} />
      <div className="grid gap-5 2xl:grid-cols-[1fr_340px]">
        <div className="card p-3">
          <TrackFeed journeyId={j.id} controls className="aspect-[16/9] w-full"><FloatingSensors journeyId={j.id} /></TrackFeed>
          <div className="mt-3 grid grid-cols-2 gap-3 px-1 pb-1 text-center sm:grid-cols-4">
            {[["Speed", `${sim.speed.toFixed(0)} km/h`], ["Location", `KM ${sim.km.toFixed(1)}`], ["Vibration", `${sim.sample.vib.toFixed(2)} g`], ["Frame rate", "30 fps"]].map(([a, b]) => (
              <div key={a} className="rounded-xl bg-surface2 py-2.5"><div className="text-[11px] text-muted">{a}</div><div className="font-bold tabular-nums">{b}</div></div>
            ))}
          </div>
        </div>
        <div className="card flex flex-col p-5">
          <h2 className="card-title mb-4 flex items-center gap-2"><Camera className="h-4 w-4 text-primary" />Detection stream</h2>
          <div className="max-h-[560px] flex-1 space-y-2 overflow-y-auto pr-1">
            {events.slice(0, 14).map((e) => {
              const I = DEFECT_ICON[e.type];
              return (
                <div key={e.id} className="flex items-center gap-3 rounded-xl bg-surface2/60 p-2.5">
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg" style={{ background: DEFECTS[e.type].color + "22", color: DEFECTS[e.type].color }}><I className="h-4 w-4" /></div>
                  <div className="min-w-0 flex-1"><div className="truncate text-sm font-semibold">{DEFECTS[e.type].short}</div><div className="font-mono text-[11px] text-muted">KM {e.km.toFixed(1)} · {ago(e.ts, now)}</div></div>
                  <span className={cn("text-xs font-bold tabular-nums")}>{Math.round(e.confidence * 100)}%</span>
                </div>
              );
            })}
            {events.length === 0 && <p className="py-10 text-center text-sm text-muted">Scanning track…</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
