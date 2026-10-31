"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Activity, BarChart3, Bell, Cpu, FileVideo, LayoutDashboard, LayoutGrid, Map as MapIcon, PanelLeftClose, PanelLeftOpen, Menu, ScanSearch, Settings, TrainFront, Video, X, Gauge, CalendarClock, MapPin, Route as RouteIcon, ChevronDown, type LucideIcon,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { JOURNEYS } from "@/lib/journeys";
import { useActive, useMounted, useNow } from "@/lib/hooks";
import { cn, fmtDate, fmtTime } from "@/lib/utils";
import { ThemeToggle } from "./ThemeProvider";
import { Engine } from "./Engine";

const NAV: { href: string; label: string; icon: LucideIcon; badge?: boolean }[] = [
  { href: "/journeys", label: "Journeys", icon: LayoutGrid },
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/live", label: "Live Monitoring", icon: Video },
  { href: "/detections", label: "Detections", icon: ScanSearch },
  { href: "/sensors", label: "Sensor Data", icon: Activity },
  { href: "/map", label: "Journey Map", icon: MapIcon },
  { href: "/video-analysis", label: "Video Analysis", icon: FileVideo },
  { href: "/alerts", label: "Alerts", icon: Bell, badge: true },
  { href: "/reports", label: "Reports", icon: BarChart3 },
  { href: "/connect", label: "Hardware", icon: Cpu },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Logo({ collapsed = false }: { collapsed?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <div className="relative grid h-10 w-10 shrink-0 place-items-center rounded-xl text-white shadow-lg shadow-primary/30" style={{ background: "linear-gradient(135deg, rgb(var(--primary)), rgb(var(--accent)))" }}>
        <TrainFront className="h-5 w-5" />
      </div>
      {!collapsed && (
        <div className="leading-tight">
          <div className="text-[17px] font-extrabold tracking-tight">TrackGuard</div>
          <div className="text-[10.5px] font-medium uppercase tracking-wider text-muted">Track Monitoring</div>
        </div>
      )}
    </div>
  );
}

function Sidebar({ collapsed, onNavigate }: { collapsed: boolean; onNavigate?: () => void }) {
  const path = usePathname();
  const open = useStore((s) => s.events.filter((e) => e.status === "open").length);
  const op = useStore((s) => s.operator);
  const hw = useStore((s) => s.hardware);
  const initials = (op?.name ?? "OP").split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
  return (
    <div className="flex h-full flex-col">
      <div className={cn("flex h-[72px] items-center border-b border-border", collapsed ? "justify-center" : "px-5")}><Logo collapsed={collapsed} /></div>
      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {NAV.map((n) => {
          const active = path === n.href || (n.href === "/journeys" && path.startsWith("/journeys"));
          return (
            <Link key={n.href} href={n.href} onClick={onNavigate} title={collapsed ? n.label : undefined}
              className={cn("group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition",
                collapsed && "justify-center px-0",
                active ? "bg-primary text-white shadow-md shadow-primary/25 dark:text-[#0b1020]" : "text-muted hover:bg-surface2 hover:text-ink")}>
              <n.icon className="h-[19px] w-[19px] shrink-0" />
              {!collapsed && <span className="truncate">{n.label}</span>}
              {n.badge && open > 0 && (
                collapsed
                  ? <span className="absolute right-2 top-1.5 h-2 w-2 rounded-full bg-bad ring-2 ring-surface" />
                  : <span className={cn("ml-auto grid min-w-[22px] place-items-center rounded-full px-1.5 py-0.5 text-[11px] font-bold", active ? "bg-white/25 text-white dark:bg-black/20 dark:text-[#0b1020]" : "bg-bad text-white")}>{open > 99 ? "99+" : open}</span>
              )}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-border p-3">
        <div className={cn("flex items-center gap-3 rounded-xl bg-surface2 p-2.5", collapsed && "justify-center bg-transparent p-0")}>
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary/15 text-xs font-bold text-primary">{initials}</div>
          {!collapsed && (
            <div className="min-w-0 leading-tight">
              <div className="truncate text-sm font-semibold">{op?.name ?? "Operator"}</div>
              <div className="truncate text-[11px] text-muted">{op?.role} · {op?.shift}</div>
            </div>
          )}
        </div>
        {!collapsed && (
          <div className="mt-2 flex items-center gap-2 px-1 text-[11px] text-muted">
            <Cpu className="h-3.5 w-3.5" />{hw.mode === "simulator" ? "Simulator mode" : `Radxa · ${hw.ip}`}
          </div>
        )}
      </div>
    </div>
  );
}

function Tile({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2.5 border-l border-border pl-4">
      <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary/10 text-primary"><Icon className="h-[18px] w-[18px]" /></div>
      <div className="leading-tight"><div className="text-[11px] text-muted">{label}</div><div className="whitespace-nowrap text-[13px] font-semibold">{value}</div></div>
    </div>
  );
}

function Topbar({ onMenu }: { onMenu: () => void }) {
  const { journey, sim } = useActive();
  const collapsed = useStore((s) => s.prefs.navCollapsed);
  const setPrefs = useStore((s) => s.setPrefs);
  const setActive = useStore((s) => s.setActive);
  const hw = useStore((s) => s.hardware);
  const now = useNow(1000);
  const router = useRouter();
  const path = usePathname();
  return (
    <header className="sticky top-0 z-30 flex h-[72px] items-center gap-3 border-b border-border bg-surface/85 px-4 backdrop-blur-xl lg:px-6">
      <button onClick={onMenu} className="grid h-10 w-10 place-items-center rounded-xl border border-border text-muted hover:text-ink lg:hidden" aria-label="Open menu"><Menu className="h-5 w-5" /></button>
      <button onClick={() => setPrefs({ navCollapsed: !collapsed })} className="hidden h-10 w-10 place-items-center rounded-xl border border-border text-muted transition hover:bg-surface2 hover:text-ink lg:grid" aria-label="Collapse navigation" title={collapsed ? "Expand navigation" : "Collapse navigation"}>
        {collapsed ? <PanelLeftOpen className="h-[18px] w-[18px]" /> : <PanelLeftClose className="h-[18px] w-[18px]" />}
      </button>
      <div className="relative">
        <select value={journey.id} aria-label="Active journey"
          onChange={(e) => { setActive(e.target.value); if (path.startsWith("/journeys/")) router.push(`/journeys/${e.target.value}`); }}
          className="h-10 max-w-[250px] cursor-pointer appearance-none rounded-xl border border-border bg-surface pl-3.5 pr-9 text-sm font-semibold outline-none transition hover:bg-surface2 focus:ring-4 focus:ring-primary/15">
          {JOURNEYS.map((j) => <option key={j.id} value={j.id}>{j.from} → {j.to}</option>)}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-3 h-4 w-4 text-muted" />
      </div>
      <div className="ml-2 hidden min-w-0 flex-1 items-center gap-5 min-[1500px]:flex">
        <Tile icon={RouteIcon} label="Route" value={`${journey.from} → ${journey.to}`} />
        <Tile icon={TrainFront} label="Train" value={journey.train} />
        <Tile icon={Gauge} label="Speed" value={`${sim.speed.toFixed(0)} km/h`} />
        <div className="hidden items-center min-[1900px]:flex"><Tile icon={MapPin} label="Location" value={`KM ${sim.km.toFixed(1)}`} /></div>
        <div className="hidden items-center min-[1900px]:flex"><Tile icon={CalendarClock} label="Date & Time" value={`${fmtDate(now)}  ${fmtTime(now)}`} /></div>
      </div>
      <div className="ml-auto flex items-center gap-2.5">
        <div className="hidden shrink-0 items-center gap-2.5 whitespace-nowrap rounded-xl border border-ok/30 bg-ok/10 px-3.5 py-2 sm:flex">
          <span className="dot-live h-2.5 w-2.5 rounded-full bg-ok text-ok" />
          <div className="leading-tight"><div className="text-[13px] font-bold text-ok">System Online</div><div className="text-[10.5px] text-muted">{hw.mode === "simulator" ? "Simulator active" : "Radxa linked"}</div></div>
        </div>
        <ThemeToggle />
      </div>
    </header>
  );
}

export function Shell({ children }: { children: React.ReactNode }) {
  const mounted = useMounted();
  const router = useRouter();
  const path = usePathname();
  const operator = useStore((s) => s.operator);
  const hwDone = useStore((s) => s.hardwareDone);
  const collapsed = useStore((s) => s.prefs.navCollapsed);
  const [drawer, setDrawer] = useState(false);

  useEffect(() => {
    if (!mounted) return;
    if (!operator) router.replace("/setup");
    else if (!hwDone) router.replace("/connect");
  }, [mounted, operator, hwDone, router]);
  useEffect(() => setDrawer(false), [path]);

  if (!mounted || !operator || !hwDone) {
    return <div className="grid h-screen place-items-center"><div className="animate-floaty text-primary"><TrainFront className="h-10 w-10" /></div></div>;
  }
  return (
    <div className="min-h-screen">
      <Engine />
      <aside className={cn("fixed inset-y-0 left-0 z-40 hidden border-r border-border bg-surface transition-[width] duration-300 lg:block", collapsed ? "w-[76px]" : "w-[264px]")}>
        <Sidebar collapsed={collapsed} />
      </aside>
      {drawer && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setDrawer(false)} />
          <aside className="absolute inset-y-0 left-0 w-[270px] border-r border-border bg-surface shadow-2xl">
            <button onClick={() => setDrawer(false)} className="absolute right-3 top-5 z-10 text-muted" aria-label="Close menu"><X className="h-5 w-5" /></button>
            <Sidebar collapsed={false} onNavigate={() => setDrawer(false)} />
          </aside>
        </div>
      )}
      <div className={cn("transition-[padding] duration-300", collapsed ? "lg:pl-[76px]" : "lg:pl-[264px]")}>
        <Topbar onMenu={() => setDrawer(true)} />
        <main key={path} className="mx-auto max-w-[1680px] p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
