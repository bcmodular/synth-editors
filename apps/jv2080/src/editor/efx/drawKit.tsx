// Shared pieces of the EFX drawings: the frame (well, title, values), a log frequency axis and a dB axis.

import type { ReactNode } from "react";

export const PAD = 8;
export const TOP = 18; // below the title line

export interface Size {
  width: number;
  height: number;
}

export function Frame({ size, title, values, children }: { size: Size; title: string; values?: string; children?: ReactNode }) {
  return (
    <>
      <rect className="well" width={size.width} height={size.height} />
      <text className="gt" x={6} y={12}>{title}</text>
      {values && <text className="gv" x={size.width - 6} y={12} textAnchor="end">{values}</text>}
      {children}
    </>
  );
}

// 20 Hz – 20 kHz across the width, logarithmically.
const F_LO = 20;
const DECADES = 3;
export const freqX = (hz: number, width: number) => PAD + (Math.log10(hz / F_LO) / DECADES) * (width - 2 * PAD);

// ±18 dB in the height below the title.
export const DB_RANGE = 18;
export function dbY(db: number, height: number): number {
  const mid = (TOP + height - PAD) / 2;
  return mid - (db / DB_RANGE) * ((height - PAD - TOP) / 2);
}

// A frequency from a list label like "250 Hz" (BYPASS and others: undefined).
export function hzOf(label: string | undefined): number | undefined {
  const m = /^(\d+) Hz$/.exec(label ?? "");
  return m ? Number(m[1]) : undefined;
}

// Sample a curve across the width as polyline points.
export function curvePoints(width: number, y: (x: number) => number, step = 2): string {
  const pts: string[] = [];
  for (let x = PAD; x <= width - PAD; x += step) pts.push(`${x.toFixed(1)},${y(x).toFixed(1)}`);
  return pts.join(" ");
}

export const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
