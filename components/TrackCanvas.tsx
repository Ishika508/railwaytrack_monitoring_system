"use client";
import { useEffect, useRef, useState } from "react";
import { useStore } from "@/lib/store";
import { DEFECTS } from "@/lib/defects";
import { ballastTile, drawBox, drawDefectArt, drawScene, finishFx, geoFor, mulberry32, sceneFor, snapWorld } from "@/lib/render";
import type { DefectType } from "@/lib/types";
import { fmtStamp } from "@/lib/utils";
import { useNow } from "@/lib/hooks";
import { getJourney } from "@/lib/journeys";
import { Maximize2, Pause, Play, Radio } from "lucide-react";

interface Live { id: string; type: DefectType; wx: number; conf: number; seed: number; born: number }
interface Ok { wx: number; conf: number; born: number }

export function TrackCanvas({ journeyId, overlay = true, paused = false, className = "" }: { journeyId: string; overlay?: boolean; paused?: boolean; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const flags = useRef({ overlay, paused });
  flags.current = { overlay, paused };

  useEffect(() => {
    const canvas = ref.current!, box = wrap.current!;
    const ctx = canvas.getContext("2d")!;
    let W = 0, H = 0, dpr = 1, sc = sceneFor(1, 1), tile: HTMLCanvasElement;
    let offset = Math.random() * 5000;
    let raf = 0, last = performance.now(), shakeUntil = 0, flashUntil = 0, nextOk = last + 2500;
    const defects: Live[] = [];
    const oks: Ok[] = [];

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = box.clientWidth; H = box.clientHeight;
      if (!W || !H) return;
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      canvas.style.width = W + "px"; canvas.style.height = H + "px";
      sc = sceneFor(W, H); tile = ballastTile(H, dpr);
    };
    resize();
    const ro = new ResizeObserver(resize); ro.observe(box);

    const spawn = (type: DefectType, conf: number, id: string) => {
      const wx0 = offset + W + sc.S;
      defects.push({ id, type, wx: snapWorld(type, sc, wx0), conf, seed: Math.floor(Math.random() * 1000), born: performance.now() });
      if (type === "jerk") shakeUntil = performance.now() + 1100;
      if (type === "orientation") { shakeUntil = performance.now() + 1800; flashUntil = performance.now() + 1800; }
    };
    const unsub = useStore.subscribe((s, p) => {
      const a = s.sims[journeyId], b = p.sims[journeyId];
      if (a && b && a.seq !== b.seq && a.lastEvent) spawn(a.lastEvent.type, a.lastEvent.confidence, a.lastEvent.id);
    });

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      if (!W || !H) return;
      const dt = Math.min((now - last) / 1000, 0.1); last = now;
      const speed = useStore.getState().sims[journeyId]?.speed ?? 60;
      if (!flags.current.paused) offset += speed * H * 0.009 * dt;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.save();
      if (now < shakeUntil) ctx.translate((Math.random() - 0.5) * 6, (Math.random() - 0.5) * 6);
      drawScene(ctx, sc, offset, tile, Math.min(speed / 12, 7));

      if (now > nextOk) {
        oks.push({ wx: snapWorld("ballast", sc, offset + W + sc.S), conf: +(0.86 + Math.random() * 0.12).toFixed(2), born: now });
        nextOk = now + 6000 + Math.random() * 6000;
      }
      for (let i = defects.length - 1; i >= 0; i--) {
        const d = defects[i], sx = d.wx - offset;
        if (sx < -sc.S * 2) { defects.splice(i, 1); continue; }
        const g = geoFor(d.type, sc, sx);
        if (!g) continue;
        drawDefectArt(ctx, d.type, sc, g, d.seed);
        if (flags.current.overlay) drawBox(ctx, g, `${DEFECTS[d.type].short} ${d.conf.toFixed(2)}`, DEFECTS[d.type].color, H);
      }
      if (flags.current.overlay) {
        for (let i = oks.length - 1; i >= 0; i--) {
          const o = oks[i], sx = o.wx - offset;
          if (sx < -sc.S * 2) { oks.splice(i, 1); continue; }
          const g = geoFor("ballast", sc, sx)!;
          drawBox(ctx, g, `Ballast OK ${o.conf.toFixed(2)}`, "#22c55e", H, 0.9);
        }
      }
      ctx.restore();
      finishFx(ctx, W, H);
      if (now < flashUntil) {
        ctx.fillStyle = `rgba(220,38,38,${0.12 + 0.12 * Math.sin(now / 90)})`;
        ctx.fillRect(0, 0, W, H);
      }
    };
    raf = requestAnimationFrame(frame);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); unsub(); };
  }, [journeyId]);

  return (
    <div ref={wrap} className={`${className.includes("absolute") ? "" : "relative"} overflow-hidden bg-[#1a1a1e] ${className}`}>
      <canvas ref={ref} className="absolute inset-0 block" />
    </div>
  );
}

/** Canvas + HUD chrome (LIVE chip, timestamp, km/speed, controls). */
export function TrackFeed({ journeyId, compact = false, controls = false, className = "", children }: { journeyId: string; compact?: boolean; controls?: boolean; className?: string; children?: React.ReactNode }) {
  const km = useStore((s) => s.sims[journeyId]?.km ?? 0);
  const speed = useStore((s) => s.sims[journeyId]?.speed ?? 0);
  const overlayPref = useStore((s) => s.prefs.overlay);
  const setPrefs = useStore((s) => s.setPrefs);
  const hw = useStore((s) => s.hardware);
  const activeId = useStore((s) => s.activeId);
  const now = useNow(1000);
  const [paused, setPaused] = useState(false);
  const [streamErr, setStreamErr] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const useStream = hw.mode === "hardware" && hw.connected && journeyId === activeId && !streamErr;
  const j = getJourney(journeyId);

  return (
    <div ref={box} className={`relative overflow-hidden rounded-xl bg-black ${className}`}>
      {useStream ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={`http://${hw.ip}:${hw.port}${hw.streamPath}`} alt="Radxa live stream" className="absolute inset-0 h-full w-full object-cover" onError={() => setStreamErr(true)} />
      ) : (
        <TrackCanvas journeyId={journeyId} overlay={overlayPref} paused={paused} className="absolute inset-0" />
      )}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between p-2.5 sm:p-3">
        <span className="glass chip"><span className="dot-live h-1.5 w-1.5 rounded-full bg-[#22c55e] text-[#22c55e]" />{useStream ? "LIVE · RADXA" : "LIVE · SIM"}</span>
        {!compact && <span className="glass chip font-mono"><Radio className="h-3 w-3" />TOP VIEW · {j.trainNo}</span>}
      </div>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 p-2.5 sm:p-3">
        <span className={`glass rounded-lg px-2.5 py-1 font-mono ${compact ? "text-[10px]" : "text-xs"}`}>{fmtStamp(now)}</span>
        <span className={`glass rounded-lg px-2.5 py-1 font-mono font-semibold ${compact ? "text-[10px]" : "text-xs"}`}>KM {km.toFixed(1)} <span className="opacity-50">|</span> {speed.toFixed(0)} km/h</span>
      </div>
      {controls && (
        <div className="absolute right-3 top-12 flex flex-col gap-2">
          <button onClick={() => setPaused((p) => !p)} className="glass grid h-9 w-9 place-items-center rounded-lg hover:bg-black/70" title={paused ? "Resume" : "Pause"}>
            {paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
          </button>
          <button onClick={() => setPrefs({ overlay: !overlayPref })} className={`glass grid h-9 w-9 place-items-center rounded-lg hover:bg-black/70 ${overlayPref ? "ring-1 ring-[#22d3ee]" : ""}`} title="Toggle detection overlay">
            <span className="text-[10px] font-bold">AI</span>
          </button>
          <button onClick={() => box.current?.requestFullscreen?.()} className="glass grid h-9 w-9 place-items-center rounded-lg hover:bg-black/70" title="Fullscreen">
            <Maximize2 className="h-4 w-4" />
          </button>
        </div>
      )}
      {children}
    </div>
  );
}
