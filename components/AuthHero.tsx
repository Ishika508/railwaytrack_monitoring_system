"use client";
import { Cpu, ScanSearch, Activity, Route as RouteIcon } from "lucide-react";
import { TrackFeed } from "./TrackCanvas";
import { Logo } from "./Shell";
import { ThemeToggle } from "./ThemeProvider";

const FEATURES = [
  { icon: ScanSearch, t: "AI defect detection", d: "Cracks, rust, burnt rail, fasteners and ballast quality from a top-view camera." },
  { icon: Activity, t: "IMU sensor intelligence", d: "Vibration, acceleration and orientation streamed live with jerk detection." },
  { icon: RouteIcon, t: "Journey tracking", d: "Follow every train on its route, station by station, defect by defect." },
  { icon: Cpu, t: "Radxa edge hardware", d: "Plug in the device over IP, or run the built-in simulator." },
];

export function AuthHero() {
  return (
    <div className="relative hidden overflow-hidden lg:flex lg:flex-col lg:justify-between lg:p-10" style={{ background: "linear-gradient(160deg, #0b1330 0%, #101a45 55%, #0a2a40 100%)" }}>
      <div className="absolute inset-0 opacity-40" style={{ backgroundImage: "radial-gradient(600px 300px at 80% 0%, rgba(99,102,241,.5), transparent 60%), radial-gradient(500px 300px at 0% 100%, rgba(6,182,212,.35), transparent 60%)" }} />
      <div className="relative z-10 text-white"><Logo /></div>
      <div className="relative z-10 space-y-8">
        <div>
          <h2 className="text-4xl font-extrabold leading-tight tracking-tight text-white">See every defect<br />before it becomes a failure.</h2>
          <p className="mt-3 max-w-md text-[15px] text-white/65">Real-time top-view railway inspection with AI detection, IMU analytics and full journey tracking.</p>
        </div>
        <TrackFeed journeyId="nag-mum" className="aspect-[16/8] w-full max-w-xl border border-white/10 shadow-2xl" />
        <div className="grid max-w-xl grid-cols-2 gap-4">
          {FEATURES.map((f) => (
            <div key={f.t} className="flex gap-3">
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white/10 text-cyan-300"><f.icon className="h-[18px] w-[18px]" /></div>
              <div><div className="text-sm font-semibold text-white">{f.t}</div><div className="text-xs leading-relaxed text-white/55">{f.d}</div></div>
            </div>
          ))}
        </div>
      </div>
      <div className="relative z-10 text-xs text-white/40">TrackGuard · Railway Track Monitoring System</div>
    </div>
  );
}

export function AuthTop() {
  return (
    <div className="mb-8 flex items-center justify-between">
      <div className="lg:hidden"><Logo /></div>
      <div className="ml-auto"><ThemeToggle /></div>
    </div>
  );
}
