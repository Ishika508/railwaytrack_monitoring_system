"use client";
import { useEffect, useRef } from "react";
import { renderSnapshot } from "@/lib/render";
import type { DefectType } from "@/lib/types";

export function DefectThumb({ type, seed, conf, className = "" }: { type: DefectType; seed: number; conf: number; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (ref.current) renderSnapshot(ref.current, type, seed, conf);
  }, [type, seed, conf]);
  return <canvas ref={ref} className={`block h-full w-full ${className}`} />;
}

export const seedOf = (id: string) => {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h % 100000;
};
