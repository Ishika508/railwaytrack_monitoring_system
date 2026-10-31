"use client";
import { useState } from "react";
import { Bell, CheckCheck } from "lucide-react";
import { useActive } from "@/lib/hooks";
import { useStore } from "@/lib/store";
import { DEFECTS } from "@/lib/defects";
import { AlertRow } from "@/components/AlertList";
import { Empty, PageHeader, Segmented } from "@/components/ui";
import type { EventStatus, Severity } from "@/lib/types";
import { getJourney } from "@/lib/journeys";

export default function Alerts() {
  const { journey: j, all, events } = useActive();
  const setAll = useStore((s) => s.setAllStatus);
  const [scope, setScope] = useState<"this" | "all">("this");
  const [sev, setSev] = useState<Severity | "all">("all");
  const [st, setSt] = useState<EventStatus | "all">("open");
  const base = scope === "this" ? events : all;
  const list = base.filter((e) => (sev === "all" || e.severity === sev) && (st === "all" || e.status === st));
  return (
    <div>
      <PageHeader icon={Bell} title="Alerts" sub={`${base.filter((e) => e.status === "open").length} open · ${base.length} total`}
        actions={<button className="btn-ghost" onClick={() => setAll(scope === "this" ? j.id : null, "ack")}><CheckCheck className="h-4 w-4" />Acknowledge all</button>} />
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <Segmented value={scope} onChange={setScope} options={[{ value: "this", label: `${j.from} → ${j.to}` }, { value: "all", label: "All journeys" }]} />
        <Segmented value={st} onChange={setSt} options={[{ value: "open", label: "Open" }, { value: "ack", label: "Acknowledged" }, { value: "resolved", label: "Resolved" }, { value: "all", label: "All" }]} />
        <Segmented value={sev} onChange={setSev} options={[{ value: "all", label: "Any severity" }, { value: "critical", label: "Critical" }, { value: "high", label: "High" }, { value: "medium", label: "Medium" }, { value: "low", label: "Low" }]} />
      </div>
      <div className="card p-4">
        {list.length === 0 ? <Empty icon={Bell} title="Nothing to show" sub="No alerts match the current filters." /> : (
          <div className="space-y-2">
            {list.slice(0, 80).map((e) => (
              <div key={e.id}>
                {scope === "all" && <div className="mb-1 ml-1 text-[11px] font-semibold text-muted">{getJourney(e.journeyId).from} → {getJourney(e.journeyId).to}</div>}
                <AlertRow e={e} actions />
              </div>
            ))}
          </div>
        )}
      </div>
      <p className="mt-3 text-xs text-muted">Recommended action for {DEFECTS.orientation.label.toLowerCase()}: {DEFECTS.orientation.action}</p>
    </div>
  );
}
