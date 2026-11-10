// Drawings for the Filter & EQ effects, from the designs: response curves with handles (Filter + Drive, Super
// Filter, Wah, SBF, Equalizer) and level columns (Isolator).

import { VALUE_TABLES } from "../../core/valueTables";
import {
  bandPass, Caption, clamp, dbScale, freqX, Handle, highShelf, lowPass, lowShelf, pct, peak, qOf, Response, signed,
  Svg,
} from "./draw";
import type { ViewProps } from "./types";
import { parseHz, useViewContext, type ViewContext } from "./viewContext";

const FREQ = VALUE_TABLES.freq as readonly number[];
const freqOf = (raw: number) => FREQ[raw] ?? 1000;
const resoDb = (q: number) => 20 * Math.log10(q);

// The shaded band an LFO sweeps: `octaves` either side of the cutoff.
function Sweep({ c, fc, octaves }: { c: ViewContext; fc: number; octaves: number }) {
  const a = freqX(fc / Math.pow(2, octaves), c.size.width);
  const b = freqX(fc * Math.pow(2, octaves), c.size.width);
  return <rect className="ar" x={a} y={0} width={Math.max(0, b - a)} height={c.size.height} style={{ fillOpacity: 0.1 }} />;
}

// 1 · CUTOFF × RESO handle on the filter curve, LOW FREQ × LOW GAIN on the shelf; DRIVE thickens the curve.
export function FilterDriveView(props: ViewProps) {
  const c = useViewContext(props);
  const fc = freqOf(c.raw(0));
  const q = qOf(c.raw(1));
  const lowPassOn = c.step(3) === 1;
  const lf = freqOf(c.raw(4));
  const lg = Math.floor((c.raw(5) / 127.5) * 49) - 24;
  const curve = (f: number) => (lowPassOn ? lowPass(f / fc, q) : lowPass(fc / f, q)) + lowShelf(f, lf, lg);
  const y = dbScale(c.size, 30);
  return (
    <Svg size={c.size}>
      <Response size={c.size} range={30} curve={curve} strokeWidth={2 + c.raw(2) / 40} />
      <Handle size={c.size} x={freqX(fc, c.size.width)} y={y(resoDb(q))} label="CUT · RESO"
        onPointerDown={c.drag({ x: { index: 0, scale: 0.55 }, y: { index: 1 } })} />
      <Handle size={c.size} x={freqX(lf, c.size.width)} y={y(lg)} label="LOW"
        onPointerDown={c.drag({ x: { index: 4, scale: 0.55 }, y: { index: 5 } })} />
      <Caption size={c.size}>{lowPassOn ? "LPF" : "HPF"} · DRIVE {pct(c.raw(2))}</Caption>
    </Svg>
  );
}

// 16 · CUTOFF × RESO handle; the shaded band is how far the LFO sweeps (DEPTH).
export function SuperFilterView(props: ViewProps) {
  const c = useViewContext(props);
  const fc = 20 * Math.pow(1000, c.raw(0) / 127);
  const q = qOf(c.raw(1));
  const type = c.step(2);
  const curve = (f: number) => {
    if (type === 0) return lowPass(f / fc, q);
    if (type === 2) return lowPass(fc / f, q);
    return bandPass(f / fc, q / 1.5) + resoDb(q) * 0.5;
  };
  const y = dbScale(c.size, 30);
  const rate = c.synced ? c.text(4) : `RATE ${pct(c.raw(4))}`;
  return (
    <Svg size={c.size}>
      <Sweep c={c} fc={fc} octaves={(c.raw(3) / 127) * 3} />
      <Response size={c.size} range={30} curve={curve} />
      <Handle size={c.size} x={freqX(fc, c.size.width)} y={y(resoDb(q))} label="CUT · RESO"
        onPointerDown={c.drag({ x: { index: 0, scale: 0.55 }, y: { index: 1 } })} />
      <Caption size={c.size}>LFO {rate} · DEPTH {pct(c.raw(3))}</Caption>
    </Svg>
  );
}

// 27 · The wah peak: MANUAL sideways, PEAK up and down; the shaded band is the sweep (DEPTH).
export function WahView(props: ViewProps) {
  const c = useViewContext(props);
  const fc = 200 * Math.pow(2, (c.raw(2) / 127) * 5.5);
  const q = 1 + (c.raw(0) / 127) * 9;
  const bandPassOn = c.step(4) === 1;
  const lift = bandPassOn ? resoDb(q) * 0.6 : resoDb(q);
  const curve = (f: number) => (bandPassOn ? bandPass(f / fc, q) + resoDb(q) * 0.6 : lowPass(f / fc, q));
  const y = dbScale(c.size, 30);
  return (
    <Svg size={c.size}>
      <Sweep c={c} fc={fc} octaves={(c.raw(3) / 127) * 2.5} />
      <Response size={c.size} range={30} curve={curve} />
      <Handle size={c.size} x={freqX(fc, c.size.width)} y={y(lift)} label="MANUAL · PEAK"
        onPointerDown={c.drag({ x: { index: 2, scale: 0.6 }, y: { index: 0 } })} />
      <Caption size={c.size}>{bandPassOn ? "BPF" : "LPF"} · RATE {c.text(1)}</Caption>
    </Svg>
  );
}

// 12 · A comb of notches: INTERVAL spaces them, WIDTH widens them; one handle sets both. (The shape is a guess.)
export function SbfView(props: ViewProps) {
  const c = useViewContext(props);
  const spacing = 0.6 + (c.raw(0) / 127) * 2;
  const width = 0.03 + (c.raw(1) / 127) * 0.2;
  const depth = -22;
  const f0 = 80;
  const curve = (f: number) => {
    const k = Math.log2(f / f0) / spacing;
    const fraction = k - Math.round(k);
    return depth * Math.exp(-Math.pow(fraction / width, 2));
  };
  const y = dbScale(c.size, 24);
  return (
    <Svg size={c.size}>
      <Response size={c.size} range={24} curve={curve} />
      <Handle size={c.size} x={freqX(f0 * Math.pow(2, spacing), c.size.width)} y={y(depth)} label="INTERVAL · WIDTH"
        onPointerDown={c.drag({ x: { index: 0, scale: 0.6 }, y: { index: 1, scale: 0.8 } })} />
      <Caption size={c.size}>{c.text(3)} · GAIN {c.text(4)} dB</Caption>
    </Svg>
  );
}

// 36 · Three-band EQ: each handle's frequency (stepped) sideways and gain (±15 dB) up and down.
export function EqualizerView(props: ViewProps) {
  const c = useViewContext(props);
  const gain = (i: number) => Number(c.text(i)) || 0;
  const freq = (i: number, fallback: number) => parseHz(c.text(i)) ?? fallback;
  const [lf, mf, hf] = [freq(3, 100), freq(4, 1000), freq(5, 8000)];
  const curve = (f: number) => lowShelf(f, lf, gain(0)) + peak(f, mf, gain(1), 0.9) + highShelf(f, hf, gain(2));
  const y = dbScale(c.size, 18);
  const bands: [string, number, number][] = [["LOW", lf, 0], ["MID", mf, 1], ["HIGH", hf, 2]];
  return (
    <Svg size={c.size}>
      <Response size={c.size} range={18} curve={curve} />
      {bands.map(([name, f, i]) => (
        <Handle key={name} size={c.size} x={freqX(f, c.size.width)} y={y(gain(i))} label={`${name} ${signed(gain(i))}`}
          onPointerDown={c.drag({ x: { index: i + 3, scale: 0.35 }, y: { index: i, scale: 0.8 } })} />
      ))}
    </Svg>
  );
}

// Isolator band level in dB, from its raw value (0 = −INF, 65 = 0 dB, 127 = +12 dB).
export const isolatorDb = (raw: number) => (raw === 0 ? -60 : raw <= 65 ? 20 * Math.log10(raw / 65) : ((raw - 65) / 62) * 12);

function IsoColumn({ c, band, name }: { c: ViewContext; band: number; name: string }) {
  const { width, height } = c.size;
  const mid = height * 0.42;
  const top = 16;
  const bottom = height - 20;
  const db = isolatorDb(c.raw(band));
  const y = db >= 0 ? mid - (db / 12) * (mid - top) : mid + (Math.min(-db, 42) / 42) * (bottom - mid);
  const x = width * (band / 3) + 10;
  const w = width / 3 - 20;
  return (
    <g>
      <rect className="af" x={x} y={Math.min(y, mid)} width={w} height={Math.abs(y - mid)} opacity={c.raw(band) === 0 ? 0.15 : 0.8} />
      <text className="gt" x={x + w / 2} y={height - 6} textAnchor="middle">{name} {c.text(band)}</text>
      <rect className="drag" x={x} y={top} width={w} height={clamp(bottom - top, 0, height)} fill="transparent"
        onPointerDown={c.drag({ y: { index: band, scale: 0.6 } })} />
    </g>
  );
}

// 4 · Three level columns (LOW / MID / HIGH), dragged up and down.
export function IsolatorView(props: ViewProps) {
  const c = useViewContext(props);
  const mid = c.size.height * 0.42;
  return (
    <Svg size={c.size}>
      <line className="ax" x1={0} y1={mid} x2={c.size.width} y2={mid} />
      <text className="gl" x={3} y={18}>+12</text>
      <text className="gl" x={3} y={mid - 3}>0</text>
      <text className="gl" x={3} y={c.size.height - 22}>−INF</text>
      {["LOW", "MID", "HIGH"].map((name, band) => <IsoColumn key={name} c={c} band={band} name={name} />)}
    </Svg>
  );
}
