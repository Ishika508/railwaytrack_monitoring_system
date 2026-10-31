import type { DefectType, JourneySim, Sample, TrackEvent } from "./types";
import { DEFECTS, DEFECT_KEYS } from "./defects";
import type { Journey } from "./journeys";
import { clamp } from "./utils";

const gauss = () => (Math.random() + Math.random() + Math.random() - 1.5) / 0.75;
const yawBase = (id: string) => 60 + (id.charCodeAt(0) * 7 + id.charCodeAt(2) * 13) % 240;
let uid = 0;
const newId = () => `EV-${Date.now().toString(36)}-${(uid++).toString(36)}`.toUpperCase();

function sampleOf(j: Journey, s: Pick<JourneySim, "speed" | "spikeV" | "spikeRoll">, t: number): Sample {
  const vib = clamp(0.14 + s.speed / 420 + gauss() * 0.025 + s.spikeV, 0.02, 3);
  return {
    t,
    speed: s.speed,
    vib,
    ax: 0.12 + gauss() * 0.035 + s.spikeV * 0.55,
    ay: -0.03 + gauss() * 0.03,
    az: 9.78 + gauss() * 0.03 - s.spikeV * 0.1,
    roll: 0.8 + Math.sin(t / 9000) * 0.5 + gauss() * 0.12 + s.spikeRoll,
    pitch: -1.2 + Math.sin(t / 13000) * 0.4 + gauss() * 0.08,
    yaw: yawBase(j.id) + Math.sin(t / 30000) * 2.2 + gauss() * 0.05,
    temp: 36 + Math.sin(t / 60000) * 1.6 + gauss() * 0.08,
  };
}

export function newSim(j: Journey): JourneySim {
  const now = Date.now();
  const base = { speed: j.cruise, spikeV: 0, spikeRoll: 0 };
  const history: Sample[] = [];
  for (let i = 90; i > 0; i--) history.push(sampleOf(j, { ...base, speed: j.cruise + gauss() * 2 }, now - i * 1000));
  return { km: j.totalKm * j.startPct, speed: j.cruise, target: j.cruise, spikeV: 0, spikeRoll: 0, sample: history[history.length - 1], history, seq: 0, laps: 0 };
}

function pickType(): DefectType {
  const total = DEFECT_KEYS.reduce((a, k) => a + DEFECTS[k].weight, 0);
  let r = Math.random() * total;
  for (const k of DEFECT_KEYS) {
    r -= DEFECTS[k].weight;
    if (r <= 0) return k;
  }
  return "rust";
}

export function stepSim(j: Journey, prev: JourneySim, o: { timeScale: number; eventRate: number }) {
  const now = Date.now();
  const s: JourneySim = { ...prev };
  if (Math.random() < 0.06) s.target = clamp(j.cruise + gauss() * 8, 25, j.cruise + 14);
  s.speed = clamp(s.speed + (s.target - s.speed) * 0.12 + gauss() * 0.35, 15, j.cruise + 18);
  s.km += (s.speed * o.timeScale) / 3600;
  if (s.km >= j.totalKm) { s.km = 0; s.laps += 1; }
  s.spikeV *= 0.78;
  s.spikeRoll *= 0.82;

  let event: TrackEvent | undefined;
  if (Math.random() < (1 / 16) * o.eventRate) {
    const type = pickType();
    const m = DEFECTS[type];
    let severity = m.severity;
    if (type === "rust" && Math.random() < 0.25) severity = "low";
    if (type === "fastener" && Math.random() < 0.3) severity = "low";
    if (type === "ballast" && Math.random() < 0.3) severity = "low";
    if (type === "jerk") { s.spikeV = 0.9 + Math.random() * 0.7; s.spikeRoll = 2 + Math.random() * 3; }
    if (type === "orientation") { s.spikeV = 1.6 + Math.random() * 0.8; s.spikeRoll = 12 + Math.random() * 8; }
    event = { id: newId(), journeyId: j.id, type, severity, confidence: +(0.78 + Math.random() * 0.2).toFixed(2), km: +s.km.toFixed(1), ts: now, status: "open" };
    s.seq += 1;
    s.lastEvent = event;
  }
  s.sample = sampleOf(j, s, now);
  s.history = [...prev.history.slice(-119), s.sample];
  return { sim: s, event };
}

/** Rolling 50 km window track condition from recent events. */
export function trackCondition(events: TrackEvent[], journeyId: string, km: number, window = 50) {
  const seg = new Array(window).fill(0);
  const start = km - window;
  for (const e of events) {
    if (e.journeyId !== journeyId || e.type === "jerk") continue;
    const idx = Math.floor(e.km - start);
    if (idx < 0 || idx >= window) continue;
    const lvl = e.severity === "low" || e.severity === "medium" ? 1 : 2;
    seg[idx] = Math.max(seg[idx], lvl);
  }
  const minor = seg.filter((v) => v === 1).length;
  const major = seg.filter((v) => v === 2).length;
  const good = window - minor - major;
  return { good: Math.round((good / window) * 100), minor: Math.round((minor / window) * 100), major: Math.round((major / window) * 100), seg };
}

export const healthScore = (events: TrackEvent[], journeyId: string, km: number) => {
  const c = trackCondition(events, journeyId, km);
  return clamp(Math.round(100 - c.minor * 0.6 - c.major * 1.8), 0, 100);
};
