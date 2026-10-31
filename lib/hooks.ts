"use client";
import { useEffect, useState } from "react";
import { useStore } from "./store";
import { getJourney } from "./journeys";
import { nextStation } from "./journeys";

export function useMounted() {
  const [m, setM] = useState(false);
  useEffect(() => setM(true), []);
  return m;
}

export function useNow(ms = 1000) {
  const [n, setN] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setN(Date.now()), ms);
    return () => clearInterval(id);
  }, [ms]);
  return n;
}

/** Everything a page needs about the currently selected journey. */
export function useActive(id?: string) {
  const activeId = useStore((s) => s.activeId);
  const jid = id ?? activeId;
  const journey = getJourney(jid);
  const sim = useStore((s) => s.sims[journey.id]);
  const events = useStore((s) => s.events);
  const mine = events.filter((e) => e.journeyId === journey.id);
  const ns = nextStation(journey, sim.km);
  const remaining = Math.max(0, ns.next.km - sim.km);
  const toEnd = Math.max(0, journey.totalKm - sim.km);
  return { journey, sim, events: mine, all: events, next: ns.next, prev: ns.prev, idx: ns.idx, remaining, toEnd, pct: (sim.km / journey.totalKm) * 100 };
}

export const useColors = () => {
  const [dark, setDark] = useState(true);
  useEffect(() => {
    const read = () => setDark(document.documentElement.classList.contains("dark"));
    read();
    const mo = new MutationObserver(read);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => mo.disconnect();
  }, []);
  return dark
    ? { primary: "#818cf8", accent: "#22d3ee", ok: "#34d399", warn: "#fbbf24", bad: "#f87171", info: "#60a5fa", violet: "#a78bfa", grid: "#202b44", text: "#8898b8", surface: "#0d1322", dark }
    : { primary: "#4361ee", accent: "#0891b2", ok: "#16a34a", warn: "#d97706", bad: "#dc2626", info: "#2563eb", violet: "#7c3aed", grid: "#e2e8f2", text: "#64748b", surface: "#ffffff", dark };
};
