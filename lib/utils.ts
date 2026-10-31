import clsx, { type ClassValue } from "clsx";

export const cn = (...a: ClassValue[]) => clsx(a);

export const pad = (n: number) => String(n).padStart(2, "0");

export const fmtTime = (ts: number, sec = false) => {
  const d = new Date(ts);
  let h = d.getHours();
  const ap = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${pad(h)}:${pad(d.getMinutes())}${sec ? ":" + pad(d.getSeconds()) : ""} ${ap}`;
};

export const fmtDate = (ts: number) =>
  new Date(ts).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });

export const fmtStamp = (ts: number) => {
  const d = new Date(ts);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};

export const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

export const rad = (d: number) => (d * Math.PI) / 180;

export function haversine(a: [number, number], b: [number, number]) {
  const R = 6371;
  const dLat = rad(b[0] - a[0]);
  const dLon = rad(b[1] - a[1]);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

export const ago = (ts: number, now = Date.now()) => {
  const s = Math.max(0, Math.round((now - ts) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
};

export function downloadText(name: string, text: string, type = "text/csv") {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}
