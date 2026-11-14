// Drawing parts for the EFX views, after the SP-404's (apps/sp404/src/fx/views/draw.tsx and parts.tsx) in the TB-3's
// graph style (the EQ's well, grid and handles): a log frequency axis, illustrative filter maths, a response panel,
// a frequency band with draggable edges, handles, drag areas and pads. The drawings make settings readable; they
// aren't measurements of the TB-3.
import type { PointerEvent as ReactPointerEvent, ReactNode } from "react";

export const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export type Hz = number;
export type Db = number;
export type Px = number;

export interface Size {
  width: Px;
  height: Px;
}

// A part of a drawing: its size, and how far down it starts.
export interface Region extends Size {
  top?: Px;
}

type PointerDown = (e: ReactPointerEvent<Element>) => void;

// ---- frequency axis (20 Hz – 20 kHz, log)

const FMIN = 20;
const FMAX = 20000;
export const freqX = (hz: Hz, width: Px): Px => (Math.log(clamp(hz, FMIN, FMAX) / FMIN) / Math.log(FMAX / FMIN)) * width;
export const xFreq = (x: Px, width: Px): Hz => FMIN * Math.pow(FMAX / FMIN, x / width);
export const hzText = (hz: Hz) => (hz >= 1000 ? `${+(hz / 1000).toFixed(hz >= 10000 ? 1 : 2)}k` : `${Math.round(hz)}`);

// ---- filter maths (illustrative), in dB; `u` is a frequency over the cutoff

export const lowPass = (u: number, q = Math.SQRT1_2): Db => -10 * Math.log10((1 - u * u) ** 2 + (u / q) ** 2);
export const highPass = (u: number, q = Math.SQRT1_2): Db => lowPass(1 / u, q);
export const lowShelf = (f: Hz, fc: Hz, gain: Db): Db => gain / (1 + (f / fc) ** 2);
export const highShelf = (f: Hz, fc: Hz, gain: Db): Db => (gain * (f / fc) ** 2) / (1 + (f / fc) ** 2);

// Points of a curve sampled every `step` px across a drawing: y(x).
export function sample(width: Px, y: (x: Px) => Px, step = 2): string {
  const points: string[] = [];
  for (let x = 0; x <= width; x += step) points.push(`${x.toFixed(1)},${y(x).toFixed(1)}`);
  return points.join(" ");
}

// dB → y for a panel of `range` dB either side of its middle line.
export const dbScale =
  ({ height, top = 0 }: Region, range: Db) =>
  (db: Db): Px =>
    top + height / 2 - (clamp(db, -range, range) / range) * (height / 2 - 8);

// ---- panels

export const Svg = ({ size, label, children }: { size: Size; label: string; children: ReactNode }) => (
  <svg className="efxview" width={size.width} height={size.height} role="img" aria-label={label}>
    {children}
  </svg>
);

export const Well = ({ region }: { region: Region }) => (
  <rect className="well" y={region.top ?? 0} width={region.width} height={region.height} />
);

const GRID_FREQS: [Hz, string][] = [
  [100, "100"],
  [1000, "1k"],
  [10000, "10k"],
];

export function FreqGrid({ region, labels = true }: { region: Region; labels?: boolean }) {
  const { width, height, top = 0 } = region;
  return (
    <>
      {GRID_FREQS.map(([f, label]) => (
        <g key={f}>
          <line className="grid" x1={freqX(f, width)} y1={top} x2={freqX(f, width)} y2={top + height} />
          {labels && (
            <text className="glabel" x={freqX(f, width) + 3} y={top + height - 4}>
              {label}
            </text>
          )}
        </g>
      ))}
    </>
  );
}

// A frequency response in its well, filled from 0 dB.
export function Response({ region, range, curve }: { region: Region; range: Db; curve: (hz: Hz) => Db }) {
  const y = dbScale(region, range);
  const mid = y(0);
  const points = sample(region.width, (x) => y(curve(xFreq(x, region.width))));
  return (
    <g>
      <Well region={region} />
      <FreqGrid region={region} />
      <line className="axis" x1={0} y1={mid} x2={region.width} y2={mid} />
      <polygon className="area" points={`0,${mid} ${points} ${region.width},${mid}`} />
      <polyline className="trace" points={points} />
    </g>
  );
}

// ---- handles

export interface HandleProps {
  size: Size;
  x: Px;
  y: Px;
  label?: string;
  below?: boolean; // label under the dot
  cursor?: "move" | "ew-resize" | "ns-resize";
  onPointerDown: PointerDown;
  onReset?: () => void;
}

// A ring with a larger invisible hit area and a label above it (below when asked, or near the top).
export function Handle({ size, x, y, label, below, cursor = "move", onPointerDown, onReset }: HandleProps) {
  const cx = clamp(x, 6, size.width - 6);
  const cy = clamp(y, 6, size.height - 6);
  const under = below || cy < 18;
  const half = label ? label.length * 3.4 + 2 : 0; // about half the label's width at 11 px
  return (
    <g className="handle" role="slider" aria-label={label}>
      {label && (
        <text className="glabel hlabel" x={clamp(cx, half, size.width - half)} y={under ? cy + 16 : cy - 9}
          textAnchor="middle">
          {label}
        </text>
      )}
      <circle className="dot" cx={cx} cy={cy} r={4} />
      <circle className="hit" style={{ cursor }} cx={cx} cy={cy} r={9} onPointerDown={onPointerDown}
        onDoubleClick={onReset} />
    </g>
  );
}

// An invisible area to drag (the whole of a wave, say).
export const DragArea = (p: { region: Region; cursor: string; label?: string; onPointerDown: PointerDown }) => (
  <rect
    className="dragarea"
    aria-label={p.label}
    style={{ cursor: p.cursor }}
    y={p.region.top ?? 0}
    width={p.region.width}
    height={p.region.height}
    onPointerDown={p.onPointerDown}
  />
);

// A caption in a corner of a region.
export function Caption({ region, right, children }: { region: Region; right?: boolean; children: ReactNode }) {
  return (
    <text className="gcap" x={right ? region.width - 4 : 4} y={(region.top ?? 0) + 12} textAnchor={right ? "end" : "start"}>
      {children}
    </text>
  );
}

// ---- band

export interface BandEdge {
  hz: Hz | undefined; // undefined = open ("Flat")
  label: string;
  onPointerDown: PointerDown;
  onReset?: () => void;
}

// One draggable edge of a band, its frequency written inside the band.
function Edge({ e, x, region, end }: { e: BandEdge; x: Px; region: Region; end: boolean }) {
  const { height: h, top = 0 } = region;
  return (
    <g role="slider" aria-label={e.label}>
      <rect className="bandedge" x={x - 3} y={top} width={6} height={h} />
      <rect className="hit" style={{ cursor: "ew-resize" }} x={x - 7} y={top} width={14} height={h}
        onPointerDown={e.onPointerDown} onDoubleClick={e.onReset} />
      <text className="glabel hlabel" x={end ? x - 6 : x + 6} y={top + h - 4} textAnchor={end ? "end" : "start"}>
        {e.hz ? hzText(e.hz) : "FLAT"}
      </text>
    </g>
  );
}

// A strip with the band between two frequencies lit (HPF to LPF, say); each edge drags sideways.
export function Band({ region, lo, hi, title }: { region: Region; lo?: BandEdge; hi?: BandEdge; title: string }) {
  const { width: w, height: h, top = 0 } = region;
  const x1 = lo?.hz ? freqX(lo.hz, w) : 0;
  const x2 = hi?.hz ? freqX(hi.hz, w) : w;
  return (
    <g>
      <Well region={region} />
      <FreqGrid region={region} labels={false} />
      <rect className="area" x={x1} y={top} width={Math.max(0, x2 - x1)} height={h} />
      <text className="glabel" x={w / 2} y={top + 11} textAnchor="middle">
        {title}
      </text>
      {lo && <Edge e={lo} x={x1} region={region} end={false} />}
      {hi && <Edge e={hi} x={x2} region={region} end />}
    </g>
  );
}

// ---- pads

export interface PadsProps {
  region: Region;
  labels: readonly string[];
  chosen: number;
  name: string; // what the pads choose, for screen readers
  onPick: (i: number) => void;
}

// A row of buttons drawn in a view; the chosen one is lit.
export function Pads({ region, labels, chosen, name, onPick }: PadsProps) {
  const w = region.width / labels.length;
  const top = region.top ?? 0;
  return (
    <g role="radiogroup" aria-label={name}>
      {labels.map((label, i) => (
        <g key={label} className={`pad ${chosen === i ? "on" : ""}`} role="radio" aria-checked={chosen === i}
          aria-label={label}
          onClick={() => onPick(i)}>
          <rect x={i * w + 1} y={top} width={w - 2} height={region.height} rx={2} />
          <text x={i * w + w / 2} y={top + region.height / 2 + 4} textAnchor="middle">
            {label}
          </text>
        </g>
      ))}
    </g>
  );
}
