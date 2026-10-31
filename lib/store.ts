"use client";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { EventStatus, HardwareConfig, JourneySim, Operator, Prefs, Sample, TrackEvent } from "./types";
import { JOURNEYS } from "./journeys";
import { newSim, stepSim } from "./sim";

interface State {
  operator: Operator | null;
  setOperator: (o: Operator | null) => void;
  hardware: HardwareConfig;
  setHardware: (h: Partial<HardwareConfig>) => void;
  hardwareDone: boolean;
  setHardwareDone: (v: boolean) => void;
  prefs: Prefs;
  setPrefs: (p: Partial<Prefs>) => void;
  activeId: string;
  setActive: (id: string) => void;

  sims: Record<string, JourneySim>;
  events: TrackEvent[];
  tick: () => void;
  injectSample: (id: string, s: Partial<Sample>) => void;
  setStatus: (id: string, st: EventStatus) => void;
  setAllStatus: (journeyId: string | null, st: EventStatus) => void;
  clearEvents: () => void;
  resetAll: () => void;
}

const initialSims = () => Object.fromEntries(JOURNEYS.map((j) => [j.id, newSim(j)]));

export const defaultHardware: HardwareConfig = {
  mode: "simulator",
  ip: "192.168.1.50",
  port: "8080",
  streamPath: "/stream.mjpg",
  sensorPath: "/api/sensors",
  statusPath: "/api/status",
  connected: false,
};

export const useStore = create<State>()(
  persist(
    (set, get) => ({
      operator: null,
      setOperator: (operator) => set({ operator }),
      hardware: defaultHardware,
      setHardware: (h) => set((s) => ({ hardware: { ...s.hardware, ...h } })),
      hardwareDone: false,
      setHardwareDone: (hardwareDone) => set({ hardwareDone }),
      prefs: { timeScale: 20, vibWarn: 0.45, eventRate: 1, navCollapsed: false, overlay: true },
      setPrefs: (p) => set((s) => ({ prefs: { ...s.prefs, ...p } })),
      activeId: JOURNEYS[0].id,
      setActive: (activeId) => set({ activeId }),

      sims: initialSims(),
      events: [],
      tick: () => {
        const { sims, prefs } = get();
        const next: Record<string, JourneySim> = {};
        const fresh: TrackEvent[] = [];
        for (const j of JOURNEYS) {
          const r = stepSim(j, sims[j.id], { timeScale: prefs.timeScale, eventRate: prefs.eventRate });
          next[j.id] = r.sim;
          if (r.event) fresh.push(r.event);
        }
        set((s) => ({ sims: next, events: fresh.length ? [...fresh, ...s.events].slice(0, 600) : s.events }));
      },
      injectSample: (id, patch) =>
        set((s) => {
          const sim = s.sims[id];
          if (!sim) return s;
          const sample = { ...sim.sample, ...patch, t: Date.now() };
          return { sims: { ...s.sims, [id]: { ...sim, speed: patch.speed ?? sim.speed, sample, history: [...sim.history.slice(-119), sample] } } };
        }),
      setStatus: (id, st) => set((s) => ({ events: s.events.map((e) => (e.id === id ? { ...e, status: st } : e)) })),
      setAllStatus: (journeyId, st) =>
        set((s) => ({ events: s.events.map((e) => (!journeyId || e.journeyId === journeyId ? { ...e, status: st } : e)) })),
      clearEvents: () => set({ events: [] }),
      resetAll: () => set({ operator: null, hardware: defaultHardware, hardwareDone: false, events: [], sims: initialSims() }),
    }),
    {
      name: "trackguard-v1",
      partialize: (s) => ({ operator: s.operator, hardware: s.hardware, hardwareDone: s.hardwareDone, prefs: s.prefs, activeId: s.activeId, sims: s.sims, events: s.events.slice(0, 300) }),
    }
  )
);
