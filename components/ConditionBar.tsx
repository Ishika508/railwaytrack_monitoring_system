"use client";
import { useMemo } from "react";
import { trackCondition } from "@/lib/sim";
import { useActive } from "@/lib/hooks";

export function ConditionBar({ journeyId }: { journeyId?: string }) {
  const { journey, sim, events } = useActive(journeyId);
  const c = useMemo(() => trackCondition(events, journey.id, sim.km), [events, journey.id, Math.floor(sim.km)]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div>
      <div className="flex h-3.5 gap-[2px] overflow-hidden rounded-full">
        {c.seg.map((v, i) => (
          <div key={i} className="h-full flex-1 transition-colors duration-500" style={{ background: v === 0 ? "rgb(var(--ok))" : v === 1 ? "rgb(var(--warn))" : "rgb(var(--bad))" }} />
        ))}
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
        {[["Good", c.good, "ok"], ["Minor Defect", c.minor, "warn"], ["Major Defect", c.major, "bad"]].map(([l, v, t]) => (
          <div key={l as string}>
            <div className="flex items-center justify-center gap-1.5 text-xs text-muted"><span className={`h-2 w-2 rounded-sm bg-${t}`} />{l}</div>
            <div className={`text-xl font-bold tabular-nums text-${t}`}>{v}%</div>
          </div>
        ))}
      </div>
    </div>
  );
}
