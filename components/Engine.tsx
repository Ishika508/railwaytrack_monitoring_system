"use client";
import { useEffect } from "react";
import { useStore } from "@/lib/store";

/** Drives the simulator and (optionally) pulls live IMU data from the Radxa. */
export function Engine() {
  useEffect(() => {
    const id = setInterval(() => useStore.getState().tick(), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    let stop = false;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      const { hardware: h, activeId, injectSample } = useStore.getState();
      if (h.mode === "hardware" && h.connected) {
        try {
          const ctl = new AbortController();
          const to = setTimeout(() => ctl.abort(), 1500);
          const r = await fetch(`http://${h.ip}:${h.port}${h.sensorPath}`, { signal: ctl.signal });
          clearTimeout(to);
          const d = await r.json();
          const acc = Array.isArray(d.accel) ? d.accel : [d.accel?.x, d.accel?.y, d.accel?.z];
          const o = d.orientation ?? {};
          injectSample(activeId, {
            ...(d.speed != null && { speed: +d.speed }),
            ...(d.vibration != null && { vib: +d.vibration }),
            ...(acc[0] != null && { ax: +acc[0], ay: +acc[1], az: +acc[2] }),
            ...(o.roll != null && { roll: +o.roll, pitch: +o.pitch, yaw: +o.yaw }),
            ...(d.temperature != null && { temp: +d.temperature }),
          });
        } catch { /* device unreachable – simulator values continue */ }
      }
      if (!stop) timer = setTimeout(poll, 700);
    };
    timer = setTimeout(poll, 700);
    return () => { stop = true; clearTimeout(timer); };
  }, []);
  return null;
}
