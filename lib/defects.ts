import type { DefectType, Severity } from "./types";

export interface DefectMeta {
  label: string;
  short: string;
  color: string;
  severity: Severity;
  weight: number;
  desc: string;
  action: string;
}

export const DEFECTS: Record<DefectType, DefectMeta> = {
  sleeper_crack: { label: "Sleeper Crack", short: "Sleeper Crack", color: "#ef4444", severity: "high", weight: 16, desc: "Structural crack detected on concrete sleeper.", action: "Schedule sleeper replacement within 7 days." },
  rail_crack: { label: "Rail Crack", short: "Rail Crack", color: "#ef4444", severity: "high", weight: 12, desc: "Transverse crack identified on rail head.", action: "Impose speed restriction and dispatch inspection team." },
  rust: { label: "Rail Wear / Rust", short: "Rust / Wear", color: "#f59e0b", severity: "medium", weight: 22, desc: "Surface corrosion and wear on rail head.", action: "Include in next grinding and maintenance cycle." },
  ballast: { label: "Low Ballast Quality", short: "Ballast Low", color: "#f59e0b", severity: "medium", weight: 20, desc: "Fouled or depleted ballast bed between sleepers.", action: "Plan tamping and ballast top-up." },
  fastener: { label: "Loose Fastener", short: "Loose Fastener", color: "#f59e0b", severity: "medium", weight: 14, desc: "Rail clip or bolt appears displaced.", action: "Tighten or replace fastener at next patrol." },
  burnt: { label: "Burnt Track", short: "Burnt Mark", color: "#f97316", severity: "high", weight: 8, desc: "Burn mark on rail surface, possible wheel slip damage.", action: "Inspect rail head and measure depth." },
  jerk: { label: "High Vibration (Jerk)", short: "Jerk", color: "#3b82f6", severity: "low", weight: 6, desc: "Sudden vibration spike recorded by the IMU.", action: "Review track geometry at this location." },
  orientation: { label: "Sudden Orientation Change", short: "Orientation", color: "#dc2626", severity: "critical", weight: 2, desc: "Abrupt roll/pitch change. Possible derailment risk.", action: "Stop and inspect immediately." },
};

export const DEFECT_KEYS = Object.keys(DEFECTS) as DefectType[];

export const SEV_ORDER: Record<Severity, number> = { low: 0, medium: 1, high: 2, critical: 3 };
export const SEV_STYLE: Record<Severity, string> = {
  low: "bg-info/12 text-info",
  medium: "bg-warn/15 text-warn",
  high: "bg-bad/12 text-bad",
  critical: "bg-bad text-white",
};
