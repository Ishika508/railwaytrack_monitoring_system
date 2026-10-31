"use client";
import { Activity, Compass, Gauge, Move3d, Thermometer, TrainFront } from "lucide-react";
import { useActive, useColors } from "@/lib/hooks";
import { useStore } from "@/lib/store";
import { PageHeader } from "@/components/ui";
import { LiveChart } from "@/components/Charts";
import { RingGauge, Spark } from "@/components/Spark";

function Box3D({ roll, pitch }: { roll: number; pitch: number }) {
  return (
    <div className="grid h-36 place-items-center" style={{ perspective: 500 }}>
      <div className="grid h-20 w-32 place-items-center rounded-2xl border border-primary/50 bg-primary/10 text-primary shadow-xl shadow-primary/20 transition-transform duration-500"
        style={{ transform: `rotateX(${55 + pitch * 4}deg) rotateZ(${roll * 5}deg)` }}>
        <TrainFront className="h-9 w-9" />
      </div>
    </div>
  );
}

export default function Sensors() {
  const { sim } = useActive();
  const warn = useStore((s) => s.prefs.vibWarn);
  const c = useColors();
  const s = sim.sample, h = sim.history.slice(-40);
  const stat = (icon: React.ElementType, label: string) => { const I = icon; return <div className="mb-3 flex items-center gap-2 text-sm font-semibold"><I className="h-4 w-4 text-primary" />{label}</div>; };
  return (
    <div>
      <PageHeader icon={Activity} title="Sensor Data" sub="Live IMU, vibration and thermal telemetry · 1 Hz" />
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        <div className="card p-5">{stat(Activity, "Vibration")}<div className="flex items-center gap-4"><RingGauge value={s.vib} max={1} size={96} color={s.vib > warn ? c.warn : c.ok} label={s.vib.toFixed(2)} unit="g" /><div><span className={`chip ${s.vib > warn ? "bg-warn/15 text-warn" : "bg-ok/12 text-ok"}`}>{s.vib > warn ? "Elevated" : "Normal"}</span><div className="mt-2 text-xs text-muted">Warn at {warn.toFixed(2)} g</div></div></div></div>
        <div className="card p-5">{stat(Move3d, "Acceleration (m/s²)")}<div className="grid grid-cols-3 gap-2">{[["X", s.ax], ["Y", s.ay], ["Z", s.az]].map(([l, v]) => <div key={l as string} className="rounded-xl bg-surface2 p-2.5 text-center"><div className="text-[11px] text-muted">{l}</div><div className="font-bold tabular-nums">{(v as number).toFixed(2)}</div></div>)}</div><div className="mt-3"><Spark data={h.map((x) => x.ax)} color={c.info} h={40} /></div></div>
        <div className="card p-5">{stat(Compass, "Orientation (°)")}<div className="grid grid-cols-3 gap-2">{[["Roll", s.roll], ["Pitch", s.pitch], ["Yaw", s.yaw]].map(([l, v]) => <div key={l as string} className="rounded-xl bg-surface2 p-2.5 text-center"><div className="text-[11px] text-muted">{l}</div><div className="font-bold tabular-nums">{(v as number).toFixed(1)}</div></div>)}</div><Box3D roll={s.roll} pitch={s.pitch} /></div>
        <div className="card p-5">{stat(Thermometer, "Temperature")}<div className="flex items-end gap-2"><span className="text-4xl font-extrabold tabular-nums">{s.temp.toFixed(1)}</span><span className="mb-1 text-muted">°C</span></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-surface2"><div className="h-full rounded-full" style={{ width: `${Math.min(100, (s.temp / 60) * 100)}%`, background: "linear-gradient(90deg, rgb(var(--ok)), rgb(var(--warn)), rgb(var(--bad)))" }} /></div><div className="mt-1 flex justify-between text-[11px] text-muted"><span>0</span><span>60 °C</span></div><div className="mt-3"><Spark data={h.map((x) => x.temp)} color={c.bad} h={40} /></div></div>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <div className="card p-5"><h2 className="card-title mb-3">Vibration (g)</h2><LiveChart history={sim.history} area series={[{ key: "vib", color: c.warn, name: "Vibration" }]} refLine={{ y: warn, label: "Warning" }} domain={[0, "auto"]} unit=" g" /></div>
        <div className="card p-5"><h2 className="card-title mb-3">Acceleration (m/s²)</h2><LiveChart history={sim.history} series={[{ key: "ax", color: c.info, name: "X" }, { key: "ay", color: c.ok, name: "Y" }]} unit="" /></div>
        <div className="card p-5"><h2 className="card-title mb-3">Orientation (°)</h2><LiveChart history={sim.history} series={[{ key: "roll", color: c.violet, name: "Roll" }, { key: "pitch", color: c.accent, name: "Pitch" }]} unit="°" /></div>
        <div className="card p-5"><h2 className="card-title mb-3 flex items-center gap-2"><Gauge className="h-4 w-4 text-primary" />Speed (km/h) & temperature (°C)</h2><LiveChart history={sim.history} series={[{ key: "speed", color: c.primary, name: "Speed" }, { key: "temp", color: c.bad, name: "Temperature" }]} /></div>
      </div>
    </div>
  );
}
