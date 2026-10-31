"use client";
import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Download, FileVideo, FlaskConical, Play, RotateCcw, Square, Upload } from "lucide-react";
import { DEFECTS } from "@/lib/defects";
import type { DefectType, Severity } from "@/lib/types";
import { PageHeader, Progress, SeverityBadge } from "@/components/ui";
import { TrackCanvas } from "@/components/TrackCanvas";
import { downloadText } from "@/lib/utils";
import { useActive } from "@/lib/hooks";

interface Det { id: number; t: number; type: DefectType; conf: number; sev: Severity; x: number; y: number; w: number; h: number; until: number }
const TYPES: DefectType[] = ["sleeper_crack", "rail_crack", "rust", "ballast", "fastener", "burnt"];
const DEMO_LEN = 30;

export default function VideoAnalysis() {
  const { journey } = useActive();
  const vid = useRef<HTMLVideoElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState<string>("");
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const [progress, setProgress] = useState(0);
  const [dets, setDets] = useState<Det[]>([]);
  const [live, setLive] = useState<Det[]>([]);
  const [drag, setDrag] = useState(false);
  const clock = useRef({ start: 0 });
  const id = useRef(0);

  const demo = !file;
  const pick = (f?: File | null) => {
    if (!f) return;
    if (url) URL.revokeObjectURL(url);
    setFile(f); setUrl(URL.createObjectURL(f)); reset();
  };
  const reset = () => { setRunning(false); setDone(false); setProgress(0); setDets([]); setLive([]); };

  const start = () => {
    reset();
    setRunning(true);
    clock.current.start = performance.now();
    if (!demo) { vid.current!.currentTime = 0; vid.current!.play().catch(() => {}); }
  };
  const stop = () => { setRunning(false); vid.current?.pause(); };

  useEffect(() => {
    if (!running) return;
    const iv = setInterval(() => {
      const v = vid.current;
      const t = demo ? (performance.now() - clock.current.start) / 1000 : v?.currentTime ?? 0;
      const dur = demo ? DEMO_LEN : v?.duration || 1;
      setProgress(Math.min(100, (t / dur) * 100));
      if (t >= dur - 0.05 || (!demo && v?.ended)) { setRunning(false); setDone(true); setProgress(100); return; }
      if (Math.random() < 0.38) {
        const type = TYPES[Math.floor(Math.random() * TYPES.length)];
        const m = DEFECTS[type];
        const d: Det = { id: ++id.current, t, type, conf: +(0.76 + Math.random() * 0.22).toFixed(2), sev: m.severity, x: 12 + Math.random() * 60, y: 22 + Math.random() * 40, w: 14 + Math.random() * 12, h: 14 + Math.random() * 14, until: performance.now() + 1500 };
        setDets((p) => [d, ...p]);
      }
      setLive((p) => p.filter((d) => d.until > performance.now()));
    }, 500);
    return () => clearInterval(iv);
  }, [running, demo]);
  useEffect(() => { if (dets.length) setLive((p) => [dets[0], ...p].slice(0, 4)); }, [dets]);
  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const fmt = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, "0")}`;
  const summary = TYPES.map((k) => ({ k, n: dets.filter((d) => d.type === k).length })).filter((x) => x.n);

  return (
    <div>
      <PageHeader icon={FileVideo} title="Video Analysis" sub="Test your model on recorded top-view track footage"
        actions={dets.length > 0 ? <button className="btn-ghost" onClick={() => downloadText("video-analysis.csv", "time_s,defect,confidence,severity\n" + dets.slice().reverse().map((d) => `${d.t.toFixed(1)},${DEFECTS[d.type].label},${d.conf},${d.sev}`).join("\n"))}><Download className="h-4 w-4" />Export CSV</button> : undefined} />
      <div className="grid gap-5 xl:grid-cols-[1.6fr_1fr]">
        <div className="space-y-5">
          <div className="card p-3">
            <div className="relative aspect-[16/9] overflow-hidden rounded-xl bg-black">
              {demo ? <TrackCanvas journeyId={journey.id} overlay={false} paused={!running} className="absolute inset-0" /> : <video ref={vid} src={url} muted playsInline className="absolute inset-0 h-full w-full object-contain" />}
              {live.map((d) => (
                <div key={d.id} className="absolute border-2 transition-opacity" style={{ left: `${d.x}%`, top: `${d.y}%`, width: `${d.w}%`, height: `${d.h}%`, borderColor: DEFECTS[d.type].color, boxShadow: `0 0 12px ${DEFECTS[d.type].color}88` }}>
                  <span className="absolute -top-5 left-[-2px] whitespace-nowrap px-1.5 py-0.5 text-[10px] font-bold text-white" style={{ background: DEFECTS[d.type].color }}>{DEFECTS[d.type].short} {d.conf.toFixed(2)}</span>
                </div>
              ))}
              <span className="glass chip absolute left-3 top-3"><FlaskConical className="h-3 w-3" />{demo ? "Demo clip (simulator)" : file?.name}</span>
              {done && <span className="chip absolute right-3 top-3 bg-ok text-white"><CheckCircle2 className="h-3 w-3" />Analysis complete</span>}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-3 px-1 pb-1">
              {!running ? <button className="btn-primary" onClick={start}><Play className="h-4 w-4" />{done ? "Run again" : "Run analysis"}</button> : <button className="btn-ghost" onClick={stop}><Square className="h-4 w-4" />Stop</button>}
              <div className="min-w-[160px] flex-1"><Progress value={progress} color="rgb(var(--primary))" /></div>
              <span className="font-mono text-xs text-muted">{progress.toFixed(0)}%</span>
              {(dets.length > 0 || file) && <button className="btn-ghost btn-sm" onClick={() => { reset(); setFile(null); setUrl(""); }}><RotateCcw className="h-3.5 w-3.5" />Reset</button>}
            </div>
          </div>

          <label onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)} onDrop={(e) => { e.preventDefault(); setDrag(false); pick(e.dataTransfer.files[0]); }}
            className={`card flex cursor-pointer flex-col items-center gap-2 border-dashed p-8 text-center transition ${drag ? "!border-primary bg-primary/8" : "hover:border-primary/50"}`}>
            <Upload className="h-8 w-8 text-primary" />
            <div className="font-semibold">Upload track video</div>
            <div className="text-xs text-muted">MP4, AVI, MOV · max 500 MB · drag and drop or click</div>
            <span className="btn-primary mt-2 btn-sm">Choose file</span>
            <input type="file" accept="video/mp4,video/avi,video/quicktime,video/*" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
          </label>
          <p className="text-xs text-muted">Analysis runs in simulator mode: detections are generated to preview the experience. To use your own model, replace the generator in <span className="kbd">app/(app)/video-analysis/page.tsx</span> with a call to your inference endpoint.</p>
        </div>

        <div className="space-y-5">
          <div className="card p-5">
            <h2 className="card-title mb-3">Summary</h2>
            {summary.length === 0 ? <p className="py-4 text-sm text-muted">Run the analysis to see detections.</p> : (
              <div className="grid grid-cols-2 gap-2.5">{summary.map((s) => <div key={s.k} className="flex items-center gap-2.5 rounded-xl bg-surface2 p-3"><span className="h-8 w-1.5 rounded-full" style={{ background: DEFECTS[s.k].color }} /><div><div className="text-xl font-bold tabular-nums">{s.n}</div><div className="text-[11px] text-muted">{DEFECTS[s.k].short}</div></div></div>)}</div>
            )}
          </div>
          <div className="card p-5">
            <h2 className="card-title mb-3">Detections ({dets.length})</h2>
            <div className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
              {dets.map((d) => (
                <div key={d.id} className="flex items-center gap-3 rounded-xl bg-surface2/60 px-3 py-2.5 text-sm">
                  <span className="w-10 font-mono text-xs text-muted">{fmt(d.t)}</span>
                  <span className="flex-1 truncate font-medium">{DEFECTS[d.type].label}</span>
                  <SeverityBadge sev={d.sev} />
                  <span className="w-10 text-right text-xs font-bold tabular-nums">{Math.round(d.conf * 100)}%</span>
                </div>
              ))}
              {dets.length === 0 && <p className="py-6 text-center text-sm text-muted">No results yet.</p>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
