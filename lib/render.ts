import type { DefectType } from "./types";
import { DEFECTS } from "./defects";

export const hash = (n: number) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};
export function mulberry32(a: number) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface Scene { W: number; H: number; S: number; railY: [number, number]; railH: number; sw: number }
export const sceneFor = (W: number, H: number): Scene => {
  const S = H * 0.46;
  return { W, H, S, railY: [H * 0.3, H * 0.7], railH: H * 0.075, sw: S * 0.34 };
};

const tileCache = new Map<string, HTMLCanvasElement>();
export function ballastTile(H: number, dpr: number): HTMLCanvasElement {
  const key = `${Math.round(H)}@${dpr}`;
  const hit = tileCache.get(key);
  if (hit) return hit;
  const tw = Math.round(H * 2.4);
  const c = document.createElement("canvas");
  c.width = Math.round(tw * dpr);
  c.height = Math.round(H * dpr);
  const g = c.getContext("2d")!;
  g.scale(dpr, dpr);
  g.fillStyle = "#26262b";
  g.fillRect(0, 0, tw, H);
  const rnd = mulberry32(1337);
  const r0 = H * 0.017;
  const n = Math.round((tw * H) / (2.6 * r0 * r0));
  for (let i = 0; i < n; i++) {
    const x = rnd() * tw, y = rnd() * H;
    const rx = r0 * (0.6 + rnd() * 0.9), rot = rnd() * Math.PI * 2;
    const l = 24 + rnd() * 30;
    const warm = rnd() < 0.25;
    const base = `hsl(${warm ? 25 : 215}, ${warm ? 9 : 5}%, ${l}%)`;
    const hi = `hsl(${warm ? 28 : 215}, 6%, ${Math.min(l + 20, 74)}%)`;
    const verts = 5 + Math.floor(rnd() * 3);
    const shape = Array.from({ length: verts }, (_, v) => {
      const ang = (v / verts) * Math.PI * 2, rr = rx * (0.72 + rnd() * 0.5);
      return [Math.cos(ang) * rr, Math.sin(ang) * rr * 0.78] as const;
    });
    for (const dx of [0, -tw, tw]) {
      const px = x + dx;
      if (px < -rx * 2 || px > tw + rx * 2) continue;
      g.save();
      g.translate(px, y);
      g.rotate(rot);
      const path = (ox: number, oy: number, k: number) => {
        g.beginPath();
        shape.forEach(([vx, vy], v) => (v ? g.lineTo(vx * k + ox, vy * k + oy) : g.moveTo(vx * k + ox, vy * k + oy)));
        g.closePath();
      };
      g.fillStyle = "rgba(0,0,0,.55)"; path(rx * 0.14, rx * 0.2, 1.05); g.fill();
      g.fillStyle = base; path(0, 0, 1); g.fill();
      g.fillStyle = hi; g.globalAlpha = 0.5; path(-rx * 0.15, -rx * 0.18, 0.55); g.fill();
      g.restore();
    }
  }
  tileCache.set(key, c);
  return c;
}

export function drawScene(ctx: CanvasRenderingContext2D, sc: Scene, offset: number, tile: HTMLCanvasElement, blur = 0) {
  const { W, H, S, railY, railH, sw } = sc;
  const tw = tile.width / (tile.height / H);
  // ballast
  let bx = -(offset % tw);
  for (let x = bx; x < W; x += tw) ctx.drawImage(tile, x, 0, tw, H);
  if (blur > 0.5) {
    ctx.globalAlpha = 0.4;
    for (let x = bx - blur; x < W; x += tw) ctx.drawImage(tile, x, 0, tw, H);
    ctx.globalAlpha = 1;
  }
  const k0 = Math.floor(offset / S) - 1;
  const k1 = Math.ceil((offset + W) / S) + 1;
  // sleepers
  for (let k = k0; k <= k1; k++) {
    const cx = k * S + S / 2 - offset;
    const y0 = H * 0.09, y1 = H * 0.91;
    ctx.fillStyle = "rgba(0,0,0,.5)";
    ctx.fillRect(cx - sw / 2 + sw * 0.12, y0 + 5, sw, y1 - y0);
    const g = ctx.createLinearGradient(cx - sw / 2, 0, cx + sw / 2, 0);
    g.addColorStop(0, "#9d978b"); g.addColorStop(0.45, "#c9c3b7"); g.addColorStop(1, "#aaa496");
    ctx.fillStyle = g;
    ctx.fillRect(cx - sw / 2, y0, sw, y1 - y0);
    ctx.fillStyle = "rgba(0,0,0,.12)";
    for (let i = 0; i < 14; i++) {
      const h = hash(k * 31 + i);
      ctx.fillRect(cx - sw / 2 + h * sw, y0 + hash(k * 17 + i * 3) * (y1 - y0), sw * 0.07, sc.H * 0.012);
    }
    // base plates
    ctx.fillStyle = "#3a3d42";
    for (const ry of railY) ctx.fillRect(cx - sw * 0.42, ry - railH * 1.05, sw * 0.84, railH * 2.1);
  }
  // rails
  for (const ry of railY) {
    ctx.fillStyle = "rgba(0,0,0,.4)";
    ctx.fillRect(0, ry - railH * 0.9 + 3, W, railH * 1.8);
    const g = ctx.createLinearGradient(0, ry - railH / 2, 0, ry + railH / 2);
    g.addColorStop(0, "#5d6168"); g.addColorStop(0.28, "#d3d6db"); g.addColorStop(0.55, "#8d9198"); g.addColorStop(1, "#44474c");
    ctx.fillStyle = g;
    ctx.fillRect(0, ry - railH / 2, W, railH);
    // rust texture along rail
    const m0 = Math.floor(offset / (S / 2)) - 1, m1 = Math.ceil((offset + W) / (S / 2)) + 1;
    for (let m = m0; m <= m1; m++) {
      const h = hash(m * 7 + ry);
      if (h < 0.55) continue;
      const x = m * (S / 2) - offset;
      ctx.fillStyle = `rgba(150,82,34,${0.08 + h * 0.22})`;
      ctx.fillRect(x, ry - railH / 2, S / 2, railH);
      for (let i = 0; i < 6; i++) {
        ctx.fillStyle = `rgba(184,98,34,${0.25 + hash(m * 13 + i) * 0.4})`;
        ctx.fillRect(x + hash(m * 5 + i * 2) * (S / 2), ry - railH / 2 + hash(m * 3 + i) * railH, 2, 2);
      }
    }
    ctx.fillStyle = "rgba(255,255,255,.35)";
    ctx.fillRect(0, ry - railH * 0.18, W, 1.5);
  }
  // clips
  for (let k = k0; k <= k1; k++) {
    const cx = k * S + S / 2 - offset;
    ctx.fillStyle = "#23262a";
    for (const ry of railY) {
      ctx.fillRect(cx - sw * 0.3, ry - railH * 0.78, sw * 0.18, railH * 0.26);
      ctx.fillRect(cx - sw * 0.3, ry + railH * 0.52, sw * 0.18, railH * 0.26);
      ctx.fillRect(cx + sw * 0.12, ry - railH * 0.78, sw * 0.18, railH * 0.26);
      ctx.fillRect(cx + sw * 0.12, ry + railH * 0.52, sw * 0.18, railH * 0.26);
    }
  }
}

/* ---------- defect geometry + art ---------- */
export interface Geo { x: number; y: number; w: number; h: number }

export function snapWorld(type: DefectType, sc: Scene, wx: number) {
  const k = Math.round((wx - sc.S / 2) / sc.S);
  const sleeperX = k * sc.S + sc.S / 2;
  if (type === "ballast") return sleeperX + sc.S / 2;
  if (type === "sleeper_crack" || type === "fastener") return sleeperX;
  return wx;
}

export function geoFor(type: DefectType, sc: Scene, cx: number): Geo | null {
  const { H, S, railY, railH, sw } = sc;
  switch (type) {
    case "sleeper_crack": return { x: cx - sw * 0.9, y: H * 0.36, w: sw * 1.8, h: H * 0.28 };
    case "rail_crack": return { x: cx - S * 0.22, y: railY[0] - railH * 1.5, w: S * 0.44, h: railH * 3 };
    case "burnt": return { x: cx - S * 0.25, y: railY[0] - railH * 1.5, w: S * 0.5, h: railH * 3 };
    case "rust": return { x: cx - S * 0.55, y: railY[1] - railH * 1.4, w: S * 1.1, h: railH * 2.8 };
    case "fastener": return { x: cx - sw * 0.7, y: railY[1] - railH * 1.7, w: sw * 1.4, h: railH * 3.4 };
    case "ballast": return { x: cx - S * 0.34, y: H * 0.33, w: S * 0.68, h: H * 0.34 };
    default: return null;
  }
}

function jag(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, amp: number, r: () => number, steps = 9) {
  ctx.beginPath(); ctx.moveTo(x0, y0);
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    ctx.lineTo(x0 + (x1 - x0) * t + (r() - 0.5) * amp, y0 + (y1 - y0) * t + (r() - 0.5) * amp);
  }
  ctx.lineTo(x1, y1);
}

export function drawDefectArt(ctx: CanvasRenderingContext2D, type: DefectType, sc: Scene, g: Geo, seed: number) {
  const r = mulberry32(seed * 977 + 13);
  const cx = g.x + g.w / 2, cy = g.y + g.h / 2;
  ctx.save();
  switch (type) {
    case "sleeper_crack": {
      for (let b = 0; b < 3; b++) {
        const x0 = cx + (r() - 0.5) * g.w * 0.3;
        jag(ctx, x0, g.y + g.h * (0.05 + b * 0.02), x0 + (r() - 0.5) * g.w * 0.5, g.y + g.h * (0.95 - b * 0.18), g.w * 0.22, r);
        ctx.strokeStyle = b === 0 ? "#141416" : "rgba(20,20,22,.7)";
        ctx.lineWidth = b === 0 ? 3 : 1.4; ctx.stroke();
        ctx.translate(1.5, 0); ctx.strokeStyle = "rgba(255,255,255,.28)"; ctx.lineWidth = 1; ctx.stroke(); ctx.translate(-1.5, 0);
      }
      break;
    }
    case "rail_crack": {
      jag(ctx, cx - g.w * 0.08, g.y + g.h * 0.18, cx + g.w * 0.1, g.y + g.h * 0.82, g.w * 0.16, r, 6);
      ctx.strokeStyle = "#0e0e10"; ctx.lineWidth = 2.6; ctx.stroke();
      ctx.strokeStyle = "rgba(255,255,255,.55)"; ctx.lineWidth = 0.9; ctx.translate(1.4, 0); ctx.stroke();
      break;
    }
    case "rust": {
      const p = ctx.createRadialGradient(cx, cy, 2, cx, cy, g.w * 0.6);
      p.addColorStop(0, "rgba(176,84,24,.7)"); p.addColorStop(1, "rgba(176,84,24,0)");
      ctx.fillStyle = p; ctx.fillRect(g.x, cy - sc.railH * 0.7, g.w, sc.railH * 1.4);
      for (let i = 0; i < 170; i++) {
        const x = g.x + r() * g.w, y = cy + (r() - 0.5) * sc.railH * 0.95;
        ctx.fillStyle = `rgba(${200 + r() * 40},${90 + r() * 60},${20 + r() * 20},${0.5 + r() * 0.5})`;
        ctx.fillRect(x, y, 1.5 + r() * 3, 1.5 + r() * 2.5);
      }
      break;
    }
    case "burnt": {
      for (let i = 0; i < 7; i++) {
        const x = cx + (r() - 0.5) * g.w * 0.5, y = cy + (r() - 0.5) * sc.railH * 0.5;
        const gr = ctx.createRadialGradient(x, y, 1, x, y, sc.railH * (0.5 + r() * 0.35));
        gr.addColorStop(0, "rgba(12,12,14,.95)"); gr.addColorStop(0.7, "rgba(30,34,48,.8)"); gr.addColorStop(1, "rgba(60,80,140,0)");
        ctx.fillStyle = gr; ctx.beginPath(); ctx.ellipse(x, y, sc.railH * 0.9, sc.railH * 0.5, r(), 0, 7); ctx.fill();
      }
      break;
    }
    case "fastener": {
      const ry = sc.railY[1];
      ctx.translate(cx + sc.sw * 0.1, ry + sc.railH * 0.9);
      ctx.rotate(0.5);
      ctx.fillStyle = "#5a5f66"; ctx.fillRect(-sc.sw * 0.1, -sc.railH * 0.15, sc.sw * 0.3, sc.railH * 0.3);
      ctx.fillStyle = "rgba(255,255,255,.35)"; ctx.fillRect(-sc.sw * 0.1, -sc.railH * 0.15, sc.sw * 0.3, 2);
      ctx.rotate(-0.5); ctx.translate(-(cx + sc.sw * 0.1), -(ry + sc.railH * 0.9));
      ctx.fillStyle = "#0c0c0e"; ctx.beginPath(); ctx.arc(cx - sc.sw * 0.2, ry - railHalf(sc), sc.railH * 0.22, 0, 7); ctx.fill();
      break;
    }
    case "ballast": {
      const gr = ctx.createRadialGradient(cx, cy, 2, cx, cy, g.w * 0.55);
      gr.addColorStop(0, "rgba(120,96,70,.85)"); gr.addColorStop(1, "rgba(120,96,70,0)");
      ctx.fillStyle = gr; ctx.fillRect(g.x, g.y, g.w, g.h);
      for (let i = 0; i < 40; i++) {
        ctx.fillStyle = `rgba(150,124,92,${0.3 + r() * 0.4})`;
        ctx.beginPath(); ctx.arc(g.x + r() * g.w, g.y + r() * g.h, 1 + r() * 3, 0, 7); ctx.fill();
      }
      break;
    }
  }
  ctx.restore();
}
const railHalf = (sc: Scene) => -sc.railH * 0.55;

export function drawBox(ctx: CanvasRenderingContext2D, g: Geo, label: string, color: string, H: number, alpha = 1) {
  const fs = Math.max(9, Math.min(13, H * 0.034));
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.lineWidth = Math.max(1.5, H * 0.006);
  ctx.strokeStyle = color; ctx.shadowColor = color; ctx.shadowBlur = 8;
  ctx.strokeRect(g.x, g.y, g.w, g.h);
  ctx.shadowBlur = 0;
  ctx.font = `700 ${fs}px Inter, system-ui, sans-serif`;
  const tw = ctx.measureText(label).width + fs;
  const ly = g.y - fs * 1.55 < 0 ? g.y + g.h : g.y - fs * 1.55;
  ctx.fillStyle = color; ctx.fillRect(g.x - 1, ly, tw, fs * 1.55);
  ctx.fillStyle = "#fff"; ctx.textBaseline = "middle"; ctx.fillText(label, g.x + fs * 0.5 - 1, ly + fs * 0.8);
  ctx.restore();
}

export function finishFx(ctx: CanvasRenderingContext2D, W: number, H: number) {
  const v = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
  v.addColorStop(0, "rgba(0,0,0,0)"); v.addColorStop(1, "rgba(0,0,0,.5)");
  ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "rgba(0,0,0,.06)";
  for (let y = 0; y < H; y += 3) ctx.fillRect(0, y, W, 1);
}

/** Static snapshot of a defect (for thumbnails). */
export function renderSnapshot(canvas: HTMLCanvasElement, type: DefectType, seed: number, conf: number) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const W = canvas.clientWidth || 240, H = canvas.clientHeight || 150;
  canvas.width = W * dpr; canvas.height = H * dpr;
  const ctx = canvas.getContext("2d")!;
  ctx.scale(dpr, dpr);
  const sc = sceneFor(W, H);
  const tile = ballastTile(H, dpr);
  const base = Math.floor(seed % 50) * sc.S * 3;
  const wx = snapWorld(type, sc, base + sc.S * 3.4);
  const offset = wx - W / 2;
  drawScene(ctx, sc, offset, tile, 0);
  const geo = geoFor(type, sc, W / 2);
  if (geo) {
    drawDefectArt(ctx, type, sc, geo, seed);
    drawBox(ctx, geo, `${DEFECTS[type].short} ${conf.toFixed(2)}`, DEFECTS[type].color, H);
  }
  finishFx(ctx, W, H);
}
