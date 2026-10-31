import { haversine } from "./utils";

export interface Station { name: string; lat: number; lon: number; km: number }
export interface Journey {
  id: string;
  from: string;
  to: string;
  train: string;
  trainNo: string;
  cls: string;
  cruise: number;
  startPct: number;
  color: string;
  stations: Station[];
  totalKm: number;
}

type Stop = [string, number, number];

function mk(id: string, train: string, trainNo: string, cls: string, cruise: number, startPct: number, color: string, stops: Stop[]): Journey {
  let km = 0;
  const stations = stops.map((s, i) => {
    if (i > 0) km += haversine([stops[i - 1][1], stops[i - 1][2]], [s[1], s[2]]) * 1.22;
    return { name: s[0], lat: s[1], lon: s[2], km: Math.round(km) };
  });
  return { id, from: stops[0][0], to: stops[stops.length - 1][0], train, trainNo, cls, cruise, startPct, color, stations, totalKm: stations[stations.length - 1].km };
}

export const JOURNEYS: Journey[] = [
  mk("nag-mum", "Express (Sleeper)", "12290", "Sleeper", 62, 0.32, "#6366f1", [
    ["Nagpur", 21.1458, 79.0882], ["Wardha", 20.7453, 78.6022], ["Badnera", 20.8667, 77.7333], ["Akola", 20.7096, 77.0082],
    ["Bhusawal", 21.0436, 75.785], ["Nashik Road", 19.9473, 73.84], ["Kalyan", 19.2437, 73.1355], ["Mumbai CSMT", 18.9398, 72.8355],
  ]),
  mk("nag-bho", "Intercity Express", "12160", "Chair Car", 74, 0.5, "#06b6d4", [
    ["Nagpur", 21.1458, 79.0882], ["Betul", 21.9, 77.9], ["Itarsi", 22.6167, 77.7667], ["Bhopal", 23.2599, 77.4126],
  ]),
  mk("del-jai", "Shatabdi Express", "12015", "AC Chair Car", 96, 0.18, "#f59e0b", [
    ["Delhi", 28.6139, 77.209], ["Gurugram", 28.4595, 77.0266], ["Rewari", 28.1997, 76.619], ["Alwar", 27.553, 76.6346], ["Jaipur", 26.9124, 75.7873],
  ]),
  mk("che-blr", "Double Decker", "22625", "AC Double Decker", 84, 0.65, "#10b981", [
    ["Chennai", 13.0827, 80.2707], ["Arakkonam", 13.0843, 79.6703], ["Katpadi", 12.9716, 79.137], ["Jolarpettai", 12.5667, 78.5833], ["Bengaluru", 12.9716, 77.5946],
  ]),
  mk("kol-bbs", "Freight (Heavy Haul)", "FR-4471", "Freight", 52, 0.08, "#ec4899", [
    ["Kolkata", 22.5726, 88.3639], ["Kharagpur", 22.346, 87.232], ["Balasore", 21.4934, 86.9335], ["Cuttack", 20.4625, 85.883], ["Bhubaneswar", 20.2961, 85.8245],
  ]),
];

export const getJourney = (id: string) => JOURNEYS.find((j) => j.id === id) ?? JOURNEYS[0];

export function nextStation(j: Journey, km: number) {
  const idx = j.stations.findIndex((s) => s.km > km);
  const next = idx === -1 ? j.stations[j.stations.length - 1] : j.stations[idx];
  const prev = j.stations[Math.max(0, (idx === -1 ? j.stations.length : idx) - 1)];
  return { next, prev, idx: idx === -1 ? j.stations.length - 1 : idx };
}

/* ---------- geometry for maps ---------- */
export interface RoutePoint { x: number; y: number; km: number }

export function projector(all: Station[], w: number, h: number, pad = 40) {
  const lats = all.map((s) => s.lat), lons = all.map((s) => s.lon);
  const minLat = Math.min(...lats), maxLat = Math.max(...lats), minLon = Math.min(...lons), maxLon = Math.max(...lons);
  const k = Math.cos((((minLat + maxLat) / 2) * Math.PI) / 180);
  const spanX = Math.max((maxLon - minLon) * k, 0.01), spanY = Math.max(maxLat - minLat, 0.01);
  const s = Math.min((w - pad * 2) / spanX, (h - pad * 2) / spanY);
  const ox = (w - spanX * s) / 2, oy = (h - spanY * s) / 2;
  return (lat: number, lon: number) => ({ x: ox + (lon - minLon) * k * s, y: oy + (maxLat - lat) * s });
}

export function buildRoute(j: Journey, project: (lat: number, lon: number) => { x: number; y: number }) {
  const pts: RoutePoint[] = [];
  const st = j.stations.map((s) => ({ ...s, ...project(s.lat, s.lon) }));
  for (let i = 0; i < st.length - 1; i++) {
    const a = st[i], b = st[i + 1];
    const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len, ny = dx / len;
    const N = 16;
    for (let n = 0; n < N; n++) {
      const t = n / N;
      const wob = Math.sin(t * Math.PI * 2 + i * 1.7) * len * 0.035 + Math.sin(t * Math.PI + i) * len * 0.02;
      pts.push({ x: a.x + dx * t + nx * wob, y: a.y + dy * t + ny * wob, km: a.km + (b.km - a.km) * t });
    }
  }
  const last = st[st.length - 1];
  pts.push({ x: last.x, y: last.y, km: last.km });
  const at = (km: number) => {
    const k = Math.min(Math.max(km, 0), j.totalKm);
    let i = pts.findIndex((p) => p.km >= k);
    if (i <= 0) i = 1;
    const a = pts[i - 1], b = pts[i];
    const t = b.km === a.km ? 0 : (k - a.km) / (b.km - a.km);
    return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, angle: (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI };
  };
  const d = pts.map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
  const dTo = (km: number) => {
    const part = pts.filter((p) => p.km <= km);
    const e = at(km);
    return part.map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ") + ` L${e.x.toFixed(1)} ${e.y.toFixed(1)}`;
  };
  return { pts, st, at, d, dTo };
}
