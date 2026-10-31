"use client";
import { useMemo } from "react";
import { JOURNEYS, buildRoute, getJourney, projector } from "@/lib/journeys";
import { useStore } from "@/lib/store";
import { DEFECTS } from "@/lib/defects";

const W = 800, H = 420;
const NW = 760, NH = 600;

function Grid({ w = W, h = H }: { w?: number; h?: number }) {
  const lines = [];
  for (let x = 0; x <= w; x += 40) lines.push(<line key={"x" + x} x1={x} y1={0} x2={x} y2={h} />);
  for (let y = 0; y <= h; y += 40) lines.push(<line key={"y" + y} x1={0} y1={y} x2={w} y2={y} />);
  return <g stroke="rgb(var(--border))" strokeWidth="1" opacity=".7">{lines}</g>;
}

function Train({ x, y, color }: { x: number; y: number; color: string }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <circle r="18" fill={color} opacity=".18"><animate attributeName="r" values="12;24;12" dur="2.4s" repeatCount="indefinite" /></circle>
      <circle r="9" fill="rgb(var(--surface))" stroke={color} strokeWidth="3" />
      <circle r="3.5" fill={color} />
    </g>
  );
}

/** Single-journey route map with progress, stations, defect pins and the train. */
export function RouteMap({ journeyId, className = "", showPins = true }: { journeyId: string; className?: string; showPins?: boolean }) {
  const j = getJourney(journeyId);
  const km = useStore((s) => s.sims[j.id].km);
  const events = useStore((s) => s.events);
  const route = useMemo(() => buildRoute(j, projector(j.stations, W, H, 70)), [j]);
  const t = route.at(km);
  const pins = showPins ? events.filter((e) => e.journeyId === j.id && e.type !== "jerk").slice(0, 40) : [];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={className} role="img" aria-label={`Route map ${j.from} to ${j.to}`}>
      <Grid />
      <path d={route.d} fill="none" stroke="rgb(var(--border))" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" />
      <path d={route.d} fill="none" stroke="rgb(var(--muted))" strokeOpacity=".45" strokeWidth="2" strokeDasharray="2 7" strokeLinecap="round" />
      <path d={route.dTo(km)} fill="none" stroke={j.color} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
      {pins.map((e) => {
        const p = route.at(e.km);
        return <circle key={e.id} cx={p.x} cy={p.y} r="4" fill={DEFECTS[e.type].color} stroke="rgb(var(--surface))" strokeWidth="1.5"><title>{DEFECTS[e.type].label} · KM {e.km}</title></circle>;
      })}
      {route.st.map((s, i) => {
        const passed = s.km <= km;
        const up = i % 2 === 0;
        return (
          <g key={s.name}>
            <circle cx={s.x} cy={s.y} r="9" fill="rgb(var(--surface))" stroke={passed ? j.color : "rgb(var(--muted))"} strokeWidth="4" />
            <text x={s.x} y={s.y + (up ? -20 : 32)} textAnchor="middle" fontSize="19" fontWeight="700" fill="rgb(var(--ink))" style={{ paintOrder: "stroke" }} stroke="rgb(var(--surface))" strokeWidth="4">{s.name}</text>
            <text x={s.x} y={s.y + (up ? -38 : 50)} textAnchor="middle" fontSize="14" fill="rgb(var(--muted))" fontFamily="monospace">KM {s.km}</text>
          </g>
        );
      })}
      <Train x={t.x} y={t.y} color={j.color} />
    </svg>
  );
}

/** All routes on one schematic network map. */
export function NetworkMap({ selected, onSelect, className = "" }: { selected: string; onSelect: (id: string) => void; className?: string }) {
  const sims = useStore((s) => s.sims);
  const events = useStore((s) => s.events);
  const routes = useMemo(() => {
    const proj = projector(JOURNEYS.flatMap((j) => j.stations), NW, NH, 70);
    return JOURNEYS.map((j) => ({ j, r: buildRoute(j, proj) }));
  }, []);
  return (
    <svg viewBox={`0 0 ${NW} ${NH}`} className={className} role="img" aria-label="Network map">
      <Grid w={NW} h={NH} />
      {routes.map(({ j, r }) => {
        const on = j.id === selected;
        return (
          <g key={j.id} style={{ cursor: "pointer" }} onClick={() => onSelect(j.id)} opacity={on ? 1 : 0.55}>
            <path d={r.d} fill="none" stroke="transparent" strokeWidth="18" />
            <path d={r.d} fill="none" stroke={j.color} strokeOpacity={on ? 0.28 : 0.2} strokeWidth={on ? 10 : 6} strokeLinecap="round" strokeLinejoin="round" />
            <path d={r.dTo(sims[j.id].km)} fill="none" stroke={j.color} strokeWidth={on ? 5 : 3.5} strokeLinecap="round" strokeLinejoin="round" />
            {r.st.map((s) => (
              <g key={s.name}>
                <circle cx={s.x} cy={s.y} r={on ? 6 : 4} fill="rgb(var(--surface))" stroke={j.color} strokeWidth="2" />
                {on && (s.km === 0 || s.km === j.totalKm) && (
                  <text x={s.x + 9} y={s.y - 9} fontSize="16" fontWeight="700" fill="rgb(var(--ink))" stroke="rgb(var(--surface))" strokeWidth="3.5" style={{ paintOrder: "stroke" }}>{s.name}</text>
                )}
              </g>
            ))}
            {events.filter((e) => e.journeyId === j.id && e.status === "open" && e.severity !== "low" && e.type !== "jerk").slice(0, 6).map((e) => {
              const p = r.at(e.km);
              return <circle key={e.id} cx={p.x} cy={p.y} r="3.5" fill="#ef4444" />;
            })}
            {(() => { const t = r.at(sims[j.id].km); return <Train x={t.x} y={t.y} color={j.color} />; })()}
          </g>
        );
      })}
    </svg>
  );
}
