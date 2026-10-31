"use client";
import { useRef, useState } from "react";
import { Activity, Compass, Move3d, Thermometer, GripHorizontal } from "lucide-react";
import { useActive, useColors } from "@/lib/hooks";
import { Spark } from "./Spark";
import { useStore } from "@/lib/store";

function Panel({ icon: Icon, title, value, unit, color, data, status, style }: { icon: React.ElementType; title: string; value: string; unit: string; color: string; data: number[]; status?: { text: string; ok: boolean }; style: React.CSSProperties }) {
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const drag = useRef<{ sx: number; sy: number; ox: number; oy: number } | null>(null);
  return (
    <div style={{ ...style, transform: `translate(${pos.x}px, ${pos.y}px)` }}
      className="pointer-events-auto absolute w-[150px] animate-floaty select-none rounded-2xl border border-white/15 bg-black/50 p-3 text-white shadow-2xl backdrop-blur-md"
      onPointerDown={(e) => { drag.current = { sx: e.clientX, sy: e.clientY, ox: pos.x, oy: pos.y }; (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); }}
      onPointerMove={(e) => { if (drag.current) setPos({ x: drag.current.ox + e.clientX - drag.current.sx, y: drag.current.oy + e.clientY - drag.current.sy }); }}
      onPointerUp={() => (drag.current = null)}>
      <div className="mb-1 flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-white/70"><Icon className="h-3.5 w-3.5" style={{ color }} />{title}</div>
        <GripHorizontal className="h-3.5 w-3.5 cursor-grab text-white/30" />
      </div>
      <div className="flex items-baseline gap-1"><span className="text-xl font-bold tabular-nums">{value}</span><span className="text-[11px] text-white/60">{unit}</span></div>
      <Spark data={data} color={color} h={24} />
      {status && <div className={`mt-1 flex items-center gap-1 text-[10px] font-semibold ${status.ok ? "text-emerald-400" : "text-amber-400"}`}><span className="h-1.5 w-1.5 rounded-full bg-current" />{status.text}</div>}
    </div>
  );
}

/** Draggable glass sensor graphs floating over the video. */
export function FloatingSensors({ journeyId }: { journeyId?: string }) {
  const { sim } = useActive(journeyId);
  const warn = useStore((s) => s.prefs.vibWarn);
  const c = useColors();
  const h = sim.history.slice(-40);
  const s = sim.sample;
  return (
    <div className="pointer-events-none absolute inset-0 hidden lg:block">
      <Panel icon={Activity} title="Vibration" value={s.vib.toFixed(2)} unit="g" color={c.warn} data={h.map((x) => x.vib)} status={{ text: s.vib > warn ? "Elevated" : "Normal", ok: s.vib <= warn }} style={{ left: 14, top: "22%" }} />
      <Panel icon={Move3d} title="Acceleration" value={s.ax.toFixed(2)} unit="m/s²" color={c.info} data={h.map((x) => x.ax)} style={{ left: 14, top: "52%" }} />
      <Panel icon={Compass} title="Roll / Pitch" value={`${s.roll.toFixed(1)}°`} unit={`${s.pitch.toFixed(1)}°`} color={c.violet} data={h.map((x) => x.roll)} style={{ right: 66, top: "22%" }} />
      <Panel icon={Thermometer} title="Temperature" value={s.temp.toFixed(1)} unit="°C" color={c.bad} data={h.map((x) => x.temp)} status={{ text: "Normal", ok: true }} style={{ right: 66, top: "52%" }} />
    </div>
  );
}
