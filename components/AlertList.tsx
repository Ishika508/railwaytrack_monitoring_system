"use client";
import { Check, CheckCheck } from "lucide-react";
import { DEFECTS } from "@/lib/defects";
import type { TrackEvent } from "@/lib/types";
import { cn, fmtTime } from "@/lib/utils";
import { DEFECT_ICON, SeverityBadge } from "./ui";
import { useStore } from "@/lib/store";

const BAR: Record<string, string> = { low: "bg-info", medium: "bg-warn", high: "bg-bad", critical: "bg-bad" };
const TINT: Record<string, string> = { low: "bg-info/12 text-info", medium: "bg-warn/14 text-warn", high: "bg-bad/12 text-bad", critical: "bg-bad/15 text-bad" };

export function AlertRow({ e, actions = false }: { e: TrackEvent; actions?: boolean }) {
  const setStatus = useStore((s) => s.setStatus);
  const Icon = DEFECT_ICON[e.type];
  const m = DEFECTS[e.type];
  return (
    <div className={cn("relative flex items-center gap-3 overflow-hidden rounded-xl border border-border bg-surface2/50 py-2.5 pl-4 pr-3 transition hover:bg-surface2", e.status === "resolved" && "opacity-55")}>
      <span className={cn("absolute inset-y-0 left-0 w-1", BAR[e.severity])} />
      <div className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-xl", TINT[e.severity])}><Icon className="h-[18px] w-[18px]" /></div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 text-sm font-semibold"><span className="truncate">{m.label}</span>{actions && <SeverityBadge sev={e.severity} />}</div>
        <div className="truncate text-xs text-muted">{actions ? m.desc : `KM ${e.km.toFixed(1)}`}</div>
      </div>
      <div className="shrink-0 text-right text-xs text-muted">
        {actions && <div className="font-mono">KM {e.km.toFixed(1)}</div>}
        <div className={actions ? "" : "font-mono"}>{fmtTime(e.ts)}</div>
      </div>
      {actions && (
        <div className="flex shrink-0 gap-1.5">
          {e.status === "open" && <button onClick={() => setStatus(e.id, "ack")} className="btn-ghost btn-sm" title="Acknowledge"><Check className="h-3.5 w-3.5" />Ack</button>}
          {e.status !== "resolved" && <button onClick={() => setStatus(e.id, "resolved")} className="btn-ghost btn-sm" title="Resolve"><CheckCheck className="h-3.5 w-3.5" />Resolve</button>}
          {e.status === "resolved" && <span className="chip bg-ok/12 text-ok">Resolved</span>}
        </div>
      )}
    </div>
  );
}
