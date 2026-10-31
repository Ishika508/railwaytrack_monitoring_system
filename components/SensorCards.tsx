"use client";
import { Activity, Compass, Move3d, Thermometer } from "lucide-react";
import { useActive, useColors } from "@/lib/hooks";
import { useStore } from "@/lib/store";
import { Spark } from "./Spark";

function Card({ icon: Icon, title, tone, children, data, color, chip }: { icon: React.ElementType; title: string; tone: string; children: React.ReactNode; data: number[]; color: string; chip?: { ok: boolean; text: string } }) {
  return (
    <div className="rounded-2xl border border-border bg-surface2/50 p-4 transition hover:border-primary/40">
      <div className="mb-2 flex items-center gap-3">
        <div className={`grid h-10 w-10 place-items-center rounded-xl ${tone}`}><Icon className="h-5 w-5" /></div>
        <div className="text-sm font-semibold">{title}</div>
        {chip && <span className={`chip ml-auto ${chip.ok ? "bg-ok/12 text-ok" : "bg-warn/15 text-warn"}`}><span className="h-1.5 w-1.5 rounded-full bg-current" />{chip.text}</span>}
      </div>
      {children}
      <div className="mt-2"><Spark data={data} color={color} h={34} /></div>
    </div>
  );
}

const Val = ({ l, v, u }: { l: string; v: string; u?: string }) => (
  <div><div className="text-[11px] text-muted">{l}</div><div className="text-lg font-bold tabular-nums">{v}<span className="ml-0.5 text-xs font-medium text-muted">{u}</span></div></div>
);

export function SensorCards({ journeyId }: { journeyId?: string }) {
  const { sim } = useActive(journeyId);
  const warn = useStore((s) => s.prefs.vibWarn);
  const c = useColors();
  const s = sim.sample, h = sim.history.slice(-50);
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Card icon={Move3d} title="Acceleration (IMU)" tone="bg-info/12 text-info" data={h.map((x) => x.ax)} color={c.info}>
        <div className="grid grid-cols-3 gap-2"><Val l="X" v={s.ax.toFixed(2)} /><Val l="Y" v={s.ay.toFixed(2)} /><Val l="Z" v={s.az.toFixed(2)} /></div>
      </Card>
      <Card icon={Activity} title="Vibration level" tone="bg-warn/14 text-warn" data={h.map((x) => x.vib)} color={c.warn} chip={{ ok: s.vib <= warn, text: s.vib <= warn ? "Normal" : "Elevated" }}>
        <Val l="RMS" v={s.vib.toFixed(2)} u="g" />
      </Card>
      <Card icon={Compass} title="Orientation (IMU)" tone="bg-violet-500/12 text-violet-500" data={h.map((x) => x.roll)} color={c.violet}>
        <div className="grid grid-cols-3 gap-2"><Val l="Roll" v={s.roll.toFixed(1)} u="°" /><Val l="Pitch" v={s.pitch.toFixed(1)} u="°" /><Val l="Yaw" v={s.yaw.toFixed(1)} u="°" /></div>
      </Card>
      <Card icon={Thermometer} title="Temperature" tone="bg-bad/12 text-bad" data={h.map((x) => x.temp)} color={c.bad} chip={{ ok: s.temp < 45, text: s.temp < 45 ? "Normal" : "High" }}>
        <Val l="Enclosure" v={s.temp.toFixed(1)} u="°C" />
      </Card>
    </div>
  );
}
