// Drawing parts shared by the effects' views, ported from the designs (docs/sp404-mockups/2-fx-designs.html):
// a log frequency axis, illustrative filter maths, a frequency response panel and a draggable handle. The
// drawings make settings readable; they aren't measurements of the SP-404.

import type { PointerEvent as ReactPointerEvent, ReactNode } from "react";

export const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

// Units, for reading the maths: frequency, level, drawing position, a raw parameter value (0–127), filter Q.
export type Hz = number;
export type Db = number;
export type Px = number;
export type Raw = number;
export type Q = number;
export type Ratio = number; // a frequency over a cutoff

// ---- frequency axis (20 Hz – 20 kHz, log)

const FMIN = 20;
const FMAX = 20000;
export const freqX = (hz: Hz, width: Px): Px => (Math.log(hz / FMIN) / Math.log(FMAX / FMIN)) * width;
export const xFreq = (x: Px, width: Px): Hz => FMIN * Math.pow(FMAX / FMIN, x / width);
export const hzText = (hz: Hz) => (hz >= 1000 ? `${+(hz / 1000).toFixed(hz >= 10000 ? 1 : 2)}k` : `${Math.round(hz)}`);

// ---- filter maths (illustrative), in dB

export const lowPass = (u: Ratio, q: Q): Db => -10 * Math.log10((1 - u * u) ** 2 + (u / q) ** 2);
export const bandPass = (u: Ratio, q: Q): Db => 20 * Math.log10(u / q / Math.sqrt((1 - u * u) ** 2 + (u / q) ** 2) + 1e-6);
export const lowShelf = (f: Hz, fc: Hz, gain: Db): Db => gain / (1 + (f / fc) ** 2);
export const highShelf = (f: Hz, fc: Hz, gain: Db): Db => (gain * (f / fc) ** 2) / (1 + (f / fc) ** 2);
export const peak = (f: Hz, fc: Hz, gain: Db, width = 0.8): Db => gain * Math.exp(-Math.pow(Math.log2(f / fc) / width, 2));
export const qOf = (raw: Raw): Q => 0.7 + (raw / 127) * 7;
export const pct = (raw: Raw) => (raw >= 127 ? 100 : Math.floor((raw / 127.5) * 100));
export const bipolar = (raw: Raw) => Math.round((raw / 127) * 200 - 100);
export const signed = (v: Db) => `${v > 0 ? "+" : ""}${v}`;

// ---- frequency response panel

export interface Size {
  width: number;
  height: number;
}

// A part of a drawing: its size, and how far down it starts.
export interface Region extends Size {
  top?: Px;
}

// dB → y for a response panel of `range` dB either side of its middle line.
export const dbScale = ({ height, top = 0 }: Region, range: Db) => (db: Db): Px =>
  top + height / 2 - (clamp(db, -range, range) / range) * (height / 2 - 9);

const GRID_FREQS: [number, string][] = [[100, "100"], [1000, "1k"], [10000, "10k"]];

export interface ResponseProps {
  size: Region;
  range: Db; // either side of 0
  curve: (hz: Hz) => Db;
  strokeWidth?: number;
  dbLabels?: boolean; // default true
}

function FreqGrid({ size }: { size: Region }) {
  const { width, height, top = 0 } = size;
  return (
    <>
      {GRID_FREQS.map(([f, label]) => (
        <g key={f}>
          <line className="gr" x1={freqX(f, width)} y1={top} x2={freqX(f, width)} y2={top + height} />
          <text className="gl" x={freqX(f, width) + 2} y={top + height - 3}>{label}</text>
        </g>
      ))}
    </>
  );
}

export function Response({ size, range, curve, strokeWidth, dbLabels = true }: ResponseProps) {
  const y = dbScale(size, range);
  const mid = y(0);
  const points: string[] = [];
  for (let x = 0; x <= size.width; x += 2) points.push(`${x},${y(curve(xFreq(x, size.width))).toFixed(1)}`);
  return (
    <g>
      <FreqGrid size={size} />
      {[-range / 2, range / 2].map((d) => <line key={d} className="gr" x1={0} y1={y(d)} x2={size.width} y2={y(d)} />)}
      <line className="ax" x1={0} y1={mid} x2={size.width} y2={mid} />
      {dbLabels && <text className="gl" x={3} y={y(range / 2) - 2}>+{range / 2}</text>}
      {dbLabels && <text className="gl" x={3} y={y(-range / 2) - 2}>−{range / 2}</text>}
      <polygon className="ar" points={[`0,${mid}`, ...points, `${size.width},${mid}`].join(" ")} />
      <polyline className="cv" style={strokeWidth ? { strokeWidth } : undefined} points={points.join(" ")} />
    </g>
  );
}

// Points of a curve sampled every `step` px across a drawing: y(x).
export function sample(width: Px, y: (x: Px) => Px, step = 2): string {
  const points: string[] = [];
  for (let x = 0; x <= width; x += step) points.push(`${x.toFixed(1)},${y(x).toFixed(1)}`);
  return points.join(" ");
}

// ---- handles and text

export interface HandleProps {
  size: Size;
  x: Px;
  y: Px;
  label?: string;
  onPointerDown: (e: ReactPointerEvent<SVGElement>) => void;
}

// A white dot with a larger invisible hit area and a label above it (below when near the top).
export function Handle({ size, x, y, label, onPointerDown }: HandleProps) {
  const cx = clamp(x, 7, size.width - 7);
  const cy = clamp(y, 7, size.height - 7);
  return (
    <g className="hdl" onPointerDown={onPointerDown} role="slider" aria-label={label}>
      <circle className="hit" cx={cx} cy={cy} r={13} />
      <circle className="dot" cx={cx} cy={cy} r={5.5} />
      {label && <text className="hl" x={cx} y={cy < 18 ? cy + 17 : cy - 10} textAnchor="middle">{label}</text>}
    </g>
  );
}

// A caption in the top right corner.
export const Caption = ({ size, children }: { size: Size; children: ReactNode }) => (
  <text className="gt" x={size.width - 4} y={12} textAnchor="end">{children}</text>
);

export const Svg = ({ size, children }: { size: Size; children: ReactNode }) => (
  <svg width={size.width} height={size.height} viewBox={`0 0 ${size.width} ${size.height}`}>{children}</svg>
);
