"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Camera, CheckCircle2, Cpu, FlaskConical, Globe, Loader2, Network, PlugZap, Radio, Thermometer, XCircle, Activity, Gauge, MemoryStick, Wifi } from "lucide-react";
import { useStore } from "@/lib/store";
import { useMounted } from "@/lib/hooks";
import { AuthTop } from "@/components/AuthHero";
import { Stepper } from "@/components/Stepper";
import { Logo } from "@/components/Shell";
import { cn } from "@/lib/utils";
import { Spark } from "@/components/Spark";

type St = "idle" | "run" | "ok" | "fail";
const STEPS = [
  { k: "net", label: "Network reachable", icon: Network },
  { k: "api", label: "Device API responding", icon: Globe },
  { k: "cam", label: "Top-view camera stream", icon: Camera },
  { k: "imu", label: "IMU sensor stream", icon: Activity },
];
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function probe(url: string, ms = 2500) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try { await fetch(url, { signal: ctl.signal, mode: "no-cors" }); ctl.abort(); return true; } catch { return false; } finally { clearTimeout(t); }
}

export default function Connect() {
  const mounted = useMounted();
  const router = useRouter();
  const hw = useStore((s) => s.hardware);
  const setHw = useStore((s) => s.setHardware);
  const done = useStore((s) => s.hardwareDone);
  const setDone = useStore((s) => s.setHardwareDone);
  const operator = useStore((s) => s.operator);
  const [st, setSt] = useState<Record<string, St>>({});
  const [testing, setTesting] = useState(false);
  const [dev, setDev] = useState({ cpu: [30], temp: [48], fps: [30] });
  const timer = useRef<ReturnType<typeof setInterval>>();

  useEffect(() => { if (mounted && !operator) router.replace("/setup"); }, [mounted, operator, router]);
  useEffect(() => {
    timer.current = setInterval(() => setDev((d) => ({
      cpu: [...d.cpu, 24 + Math.random() * 22].slice(-24), temp: [...d.temp, 46 + Math.random() * 5].slice(-24), fps: [...d.fps, 28 + Math.random() * 3].slice(-24),
    })), 1000);
    return () => clearInterval(timer.current);
  }, []);
  if (!mounted) return null;

  const sim = hw.mode === "simulator";
  const base = `http://${hw.ip}:${hw.port}`;

  const test = async () => {
    setTesting(true); setHw({ connected: false });
    setSt({});
    const res: Record<string, boolean> = {};
    for (const s of STEPS) {
      setSt((p) => ({ ...p, [s.k]: "run" }));
      let ok = true;
      if (sim) await sleep(450 + Math.random() * 350);
      else if (s.k === "net") ok = await probe(base);
      else if (s.k === "api") ok = await probe(base + hw.statusPath);
      else if (s.k === "cam") ok = await probe(base + hw.streamPath);
      else ok = await probe(base + hw.sensorPath);
      res[s.k] = ok;
      setSt((p) => ({ ...p, [s.k]: ok ? "ok" : "fail" }));
    }
    setHw({ connected: sim || Object.values(res).every(Boolean) });
    setTesting(false);
  };

  const ipOk = /^(\d{1,3}\.){3}\d{1,3}$|^[\w.-]+$/.test(hw.ip.trim()) && hw.ip.trim().length > 0;
  const allOk = STEPS.every((s) => st[s.k] === "ok");
  const proceed = () => { setDone(true); router.push("/journeys"); };

  return (
    <div className="min-h-screen px-5 py-6 sm:px-10">
      <div className="mx-auto max-w-6xl">
        <div className="flex items-center justify-between"><Logo /><div className="flex items-center gap-3">{done && <button onClick={() => router.push("/dashboard")} className="btn-ghost btn-sm"><ArrowLeft className="h-3.5 w-3.5" />Back to app</button>}<AuthTop /></div></div>
        <div className="mt-6 animate-fade-up"><Stepper step={2} /></div>
        <h1 className="mt-7 text-3xl font-extrabold tracking-tight">Connect hardware</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">Link the Radxa edge device that carries the top-view camera and IMU. No device yet? Continue in simulator mode and everything works with generated data.</p>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1.15fr_1fr]">
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              {([
                { m: "simulator", icon: FlaskConical, t: "Simulator mode", d: "Generated top-view video, IMU data and defects. Ideal for demos." },
                { m: "hardware", icon: Cpu, t: "Radxa hardware", d: "Live MJPEG stream and IMU readings over your local network." },
              ] as const).map((o) => (
                <button key={o.m} onClick={() => { setHw({ mode: o.m, connected: false }); setSt({}); }}
                  className={cn("card relative p-5 text-left transition", hw.mode === o.m ? "!border-primary ring-4 ring-primary/15" : "hover:border-primary/40")}>
                  <div className={cn("mb-3 grid h-11 w-11 place-items-center rounded-xl", hw.mode === o.m ? "bg-primary text-white dark:text-[#0b1020]" : "bg-surface2 text-muted")}><o.icon className="h-5 w-5" /></div>
                  <div className="font-semibold">{o.t}</div>
                  <div className="mt-1 text-xs leading-relaxed text-muted">{o.d}</div>
                  {hw.mode === o.m && <CheckCircle2 className="absolute right-4 top-4 h-5 w-5 text-primary" />}
                </button>
              ))}
            </div>

            <div className={cn("card p-6 transition", sim && "opacity-60")}>
              <div className="mb-4 flex items-center justify-between"><h2 className="card-title flex items-center gap-2"><Wifi className="h-4 w-4 text-primary" />Device address</h2>{sim && <span className="chip bg-surface2 text-muted">Not needed in simulator</span>}</div>
              <div className="grid gap-4 sm:grid-cols-[1fr_120px]">
                <div><label className="label" htmlFor="ip">IP address / hostname</label><input id="ip" className="input font-mono" disabled={sim} value={hw.ip} onChange={(e) => setHw({ ip: e.target.value, connected: false })} placeholder="192.168.1.50" /></div>
                <div><label className="label" htmlFor="port">Port</label><input id="port" className="input font-mono" disabled={sim} value={hw.port} onChange={(e) => setHw({ port: e.target.value.replace(/\D/g, ""), connected: false })} placeholder="8080" /></div>
              </div>
              <div className="mt-4 grid gap-4 sm:grid-cols-3">
                {([["streamPath", "Video stream"], ["sensorPath", "Sensor endpoint"], ["statusPath", "Status endpoint"]] as const).map(([k, l]) => (
                  <div key={k}><label className="label" htmlFor={k}>{l}</label><input id={k} className="input font-mono text-xs" disabled={sim} value={hw[k]} onChange={(e) => setHw({ [k]: e.target.value, connected: false })} /></div>
                ))}
              </div>
              {!sim && <p className="mt-4 text-xs text-muted">Target: <span className="font-mono text-ink">{base}</span> · Run <span className="kbd">hardware/radxa_server.py</span> on the Radxa (see README).</p>}
            </div>

            <div className="card p-6">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="card-title flex items-center gap-2"><PlugZap className="h-4 w-4 text-primary" />Connection check</h2>
                <button className="btn-ghost btn-sm" onClick={test} disabled={testing || (!sim && !ipOk)}>{testing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Radio className="h-3.5 w-3.5" />}{testing ? "Testing" : "Test connection"}</button>
              </div>
              <ul className="space-y-2.5">
                {STEPS.map((s) => {
                  const v = st[s.k] ?? "idle";
                  return (
                    <li key={s.k} className="flex items-center gap-3 rounded-xl bg-surface2/60 px-3.5 py-3 text-sm">
                      <s.icon className="h-4 w-4 text-muted" /><span className="flex-1 font-medium">{s.label}</span>
                      {v === "idle" && <span className="text-xs text-muted">Pending</span>}
                      {v === "run" && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
                      {v === "ok" && <span className="flex items-center gap-1 text-xs font-semibold text-ok"><CheckCircle2 className="h-4 w-4" />{sim ? "Simulated" : "OK"}</span>}
                      {v === "fail" && <span className="flex items-center gap-1 text-xs font-semibold text-bad"><XCircle className="h-4 w-4" />Unreachable</span>}
                    </li>
                  );
                })}
              </ul>
              {!sim && Object.values(st).includes("fail") && <p className="mt-3 text-xs text-warn">Some checks failed. Check the IP, that the server is running, and that the laptop and Radxa share a network. You can still continue in simulator mode.</p>}
            </div>
          </div>

          <div className="space-y-6">
            <div className="card overflow-hidden">
              <div className="relative p-6" style={{ background: "linear-gradient(135deg, rgb(var(--primary) / .14), rgb(var(--accent) / .10))" }}>
                <div className="flex items-center gap-4">
                  <div className="grid h-14 w-14 place-items-center rounded-2xl bg-surface shadow-lg"><Cpu className="h-7 w-7 text-primary" /></div>
                  <div><div className="text-lg font-bold">Radxa Edge Node</div><div className="font-mono text-xs text-muted">{sim ? "SIM-0001 · virtual device" : `${hw.ip}:${hw.port}`}</div></div>
                  <span className={cn("chip ml-auto", hw.connected ? "bg-ok/15 text-ok" : "bg-surface text-muted")}><span className={cn("h-1.5 w-1.5 rounded-full bg-current", hw.connected && "dot-live")} />{hw.connected ? "Connected" : "Not linked"}</span>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-px bg-border">
                {[{ i: Gauge, l: "CPU", v: dev.cpu, u: "%", c: "rgb(var(--primary))" }, { i: Thermometer, l: "SoC Temp", v: dev.temp, u: "°C", c: "rgb(var(--warn))" }, { i: Camera, l: "Camera", v: dev.fps, u: "fps", c: "rgb(var(--ok))" }].map((m) => (
                  <div key={m.l} className="bg-surface p-4">
                    <div className="flex items-center gap-1.5 text-xs text-muted"><m.i className="h-3.5 w-3.5" />{m.l}</div>
                    <div className="mt-1 text-xl font-bold tabular-nums">{m.v[m.v.length - 1].toFixed(0)}<span className="ml-0.5 text-xs font-medium text-muted">{m.u}</span></div>
                    <Spark data={m.v} color={m.c} h={28} />
                  </div>
                ))}
              </div>
              <div className="space-y-2.5 p-5 text-sm">
                {[["Top-view camera", "1280×720 @ 30 fps"], ["IMU (accel + gyro)", "MPU-6050 · 100 Hz"], ["Storage", "Clips on detection"], ["Mode", sim ? "Simulator" : "Live hardware"]].map(([a, b]) => (
                  <div key={a} className="flex justify-between border-b border-border pb-2.5 last:border-0 last:pb-0"><span className="text-muted">{a}</span><span className="font-medium">{b}</span></div>
                ))}
              </div>
            </div>
            <div className="card p-6">
              <div className="mb-1 flex items-center gap-2 font-semibold"><MemoryStick className="h-4 w-4 text-primary" />Ready to launch</div>
              <p className="text-sm text-muted">{sim ? "Simulator mode needs no connection check, but running it confirms everything is wired up." : allOk ? "Hardware verified. You are good to go." : "Run the connection check, or continue in simulator mode."}</p>
              <button className="btn-primary mt-4 w-full py-3.5 text-[15px]" onClick={proceed}>{done ? "Save and open dashboard" : "Launch dashboard"}<ArrowRight className="h-4 w-4" /></button>
              {!sim && !allOk && <button className="btn-ghost mt-2.5 w-full" onClick={() => { setHw({ mode: "simulator", connected: false }); proceed(); }}>Skip and use simulator</button>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
