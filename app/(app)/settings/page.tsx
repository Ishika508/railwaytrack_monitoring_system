"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Cpu, Gauge, Palette, RotateCcw, Settings as SettingsIcon, Trash2, User } from "lucide-react";
import { useStore } from "@/lib/store";
import { PageHeader, Segmented, Toggle } from "@/components/ui";
import { useTheme } from "@/components/ThemeProvider";

function Row({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border py-4 last:border-0"><div><div className="text-sm font-semibold">{title}</div>{sub && <div className="text-xs text-muted">{sub}</div>}</div>{children}</div>;
}

export default function Settings() {
  const router = useRouter();
  const { theme, toggle } = useTheme();
  const { prefs, setPrefs, operator, hardware, clearEvents, resetAll } = useStore();
  return (
    <div className="max-w-3xl">
      <PageHeader icon={SettingsIcon} title="Settings" sub="Appearance, simulation and session controls" />
      <div className="space-y-5">
        <section className="card px-5 pb-1 pt-5"><h2 className="card-title flex items-center gap-2"><Palette className="h-4 w-4 text-primary" />Appearance</h2>
          <Row title="Theme" sub="Dark is best for control rooms, light for daylight use."><Segmented value={theme} onChange={(v) => v !== theme && toggle()} options={[{ value: "dark", label: "Dark" }, { value: "light", label: "Light" }]} /></Row>
          <Row title="Detection overlay" sub="Draw AI bounding boxes on the video feed."><Toggle on={prefs.overlay} onChange={(v) => setPrefs({ overlay: v })} label="Overlay" /></Row>
          <Row title="Collapse navigation" sub="Use the icon-only sidebar."><Toggle on={prefs.navCollapsed} onChange={(v) => setPrefs({ navCollapsed: v })} label="Collapse" /></Row>
        </section>

        <section className="card px-5 pb-1 pt-5"><h2 className="card-title flex items-center gap-2"><Gauge className="h-4 w-4 text-primary" />Simulation & thresholds</h2>
          <Row title={`Simulation speed ×${prefs.timeScale}`} sub="How fast trains advance along their routes."><input type="range" min={1} max={120} value={prefs.timeScale} onChange={(e) => setPrefs({ timeScale: +e.target.value })} className="w-48 accent-[rgb(var(--primary))]" /></Row>
          <Row title={`Defect frequency ×${prefs.eventRate.toFixed(1)}`} sub="How often the simulator produces defects."><input type="range" min={0.2} max={4} step={0.1} value={prefs.eventRate} onChange={(e) => setPrefs({ eventRate: +e.target.value })} className="w-48 accent-[rgb(var(--primary))]" /></Row>
          <Row title={`Vibration warning ${prefs.vibWarn.toFixed(2)} g`} sub="Above this level the vibration status turns to Elevated."><input type="range" min={0.2} max={1} step={0.01} value={prefs.vibWarn} onChange={(e) => setPrefs({ vibWarn: +e.target.value })} className="w-48 accent-[rgb(var(--primary))]" /></Row>
        </section>

        <section className="card px-5 pb-1 pt-5"><h2 className="card-title flex items-center gap-2"><User className="h-4 w-4 text-primary" />Session</h2>
          <Row title={operator?.name ?? "Operator"} sub={`${operator?.role} · ${operator?.division} · ${operator?.shift}`}><Link href="/setup" className="btn-ghost btn-sm">Edit operator</Link></Row>
          <Row title="Hardware" sub={hardware.mode === "simulator" ? "Simulator mode" : `Radxa at ${hardware.ip}:${hardware.port}`}><Link href="/connect" className="btn-ghost btn-sm"><Cpu className="h-3.5 w-3.5" />Change</Link></Row>
        </section>

        <section className="card px-5 pb-1 pt-5"><h2 className="card-title flex items-center gap-2"><Trash2 className="h-4 w-4 text-bad" />Data</h2>
          <Row title="Clear alerts and detections" sub="Removes the current event history."><button className="btn-ghost btn-sm" onClick={clearEvents}>Clear</button></Row>
          <Row title="Reset everything" sub="Signs out the operator and restarts onboarding."><button className="btn-ghost btn-sm !border-bad/40 text-bad" onClick={() => { resetAll(); router.replace("/setup"); }}><RotateCcw className="h-3.5 w-3.5" />Reset</button></Row>
        </section>
      </div>
    </div>
  );
}
