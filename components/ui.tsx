"use client";
import { Activity, Bolt, Compass, Droplets, Flame, Mountain, Split, Wrench, Zap, type LucideIcon } from "lucide-react";
import type { DefectType, Severity } from "@/lib/types";
import { SEV_STYLE } from "@/lib/defects";
import { cn } from "@/lib/utils";

export const DEFECT_ICON: Record<DefectType, LucideIcon> = {
  sleeper_crack: Split, rail_crack: Zap, rust: Droplets, ballast: Mountain, fastener: Wrench, burnt: Flame, jerk: Activity, orientation: Compass,
};
export { Bolt };

export function SeverityBadge({ sev }: { sev: Severity }) {
  return <span className={cn("chip uppercase tracking-wide", SEV_STYLE[sev])}>{sev === "critical" ? "Critical" : sev === "high" ? "High severity" : sev === "medium" ? "Medium" : "Low"}</span>;
}

export function PageHeader({ title, sub, icon: Icon, actions }: { title: string; sub?: string; icon?: LucideIcon; actions?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4 animate-fade-up">
      <div className="flex items-center gap-3.5">
        {Icon && (
          <div className="grid h-11 w-11 place-items-center rounded-xl bg-primary/12 text-primary"><Icon className="h-5 w-5" /></div>
        )}
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          {sub && <p className="mt-0.5 text-sm text-muted">{sub}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2.5">{actions}</div>}
    </div>
  );
}

export function Tile({ icon: Icon, label, value, sub, tone = "primary", children, className }: { icon: LucideIcon; label: string; value: React.ReactNode; sub?: React.ReactNode; tone?: "primary" | "ok" | "warn" | "bad" | "info" | "accent"; children?: React.ReactNode; className?: string }) {
  const tones = { primary: "bg-primary/12 text-primary", ok: "bg-ok/12 text-ok", warn: "bg-warn/14 text-warn", bad: "bg-bad/12 text-bad", info: "bg-info/12 text-info", accent: "bg-accent/14 text-accent" };
  return (
    <div className={cn("card relative overflow-hidden p-4", className)}>
      <div className="flex items-center gap-3.5">
        <div className={cn("grid h-12 w-12 shrink-0 place-items-center rounded-2xl", tones[tone])}><Icon className="h-6 w-6" /></div>
        <div className="min-w-0">
          <div className="text-xs font-medium text-muted">{label}</div>
          <div className="truncate text-2xl font-bold leading-tight tracking-tight tabular-nums">{value}</div>
          {sub && <div className="mt-0.5 text-xs text-muted">{sub}</div>}
        </div>
      </div>
      {children}
    </div>
  );
}

export function Progress({ value, color = "rgb(var(--ok))", className }: { value: number; color?: string; className?: string }) {
  return (
    <div className={cn("h-2 w-full overflow-hidden rounded-full bg-surface2", className)}>
      <div className="h-full rounded-full transition-all duration-700" style={{ width: `${Math.min(100, Math.max(0, value))}%`, background: color }} />
    </div>
  );
}

export function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)}
      className={cn("relative h-6 w-11 shrink-0 rounded-full transition", on ? "bg-primary" : "bg-border")}>
      <span className={cn("absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all", on ? "left-[22px]" : "left-0.5")} />
    </button>
  );
}

export function Empty({ icon: Icon, title, sub }: { icon: LucideIcon; title: string; sub?: string }) {
  return (
    <div className="grid place-items-center gap-2 px-6 py-14 text-center">
      <div className="grid h-12 w-12 place-items-center rounded-2xl bg-surface2 text-muted"><Icon className="h-6 w-6" /></div>
      <div className="font-semibold">{title}</div>
      {sub && <div className="max-w-xs text-sm text-muted">{sub}</div>}
    </div>
  );
}

export function Segmented<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[] }) {
  return (
    <div className="inline-flex rounded-xl border border-border bg-surface2 p-1">
      {options.map((o) => (
        <button key={o.value} onClick={() => onChange(o.value)}
          className={cn("rounded-lg px-3 py-1.5 text-xs font-semibold transition", value === o.value ? "bg-surface text-ink shadow-sm" : "text-muted hover:text-ink")}>
          {o.label}
        </button>
      ))}
    </div>
  );
}
