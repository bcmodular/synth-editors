// Drawings for the modulation effects, from the designs: LFO shapes (To-Gu-Ro, Tremolo/Pan), the chorus voices
// over an EQ (Chorus), the Juno and JX-1 chorus buttons (JUNO Chorus), comb and phaser notches (Flanger, Phaser),
// and the pattern and speed pads (Slicer).

import { dbScale, freqX, Handle, highShelf, lowShelf, pct, Response, sample, Svg, type Px, type Region } from "./draw";
import { Pad } from "./parts";
import type { ViewProps } from "./types";
import { useViewContext, type ViewContext } from "./viewContext";
import { noteFraction } from "./delay";

// ---- LFO shapes

export type Wave = "TRI" | "SQR" | "SIN" | "SAW1" | "SAW2" | "TRP";

export function wave(shape: Wave, phase: number): number {
  const ph = phase - Math.floor(phase);
  const tri = ph < 0.5 ? 4 * ph - 1 : 3 - 4 * ph;
  switch (shape) {
    case "SQR": return ph < 0.5 ? 1 : -1;
    case "TRI": return tri;
    case "SAW1": return 2 * ph - 1;
    case "SAW2": return 1 - 2 * ph;
    case "TRP": return Math.max(-1, Math.min(1, tri * 2));
    default: return Math.sin(ph * 2 * Math.PI);
  }
}

interface Lfo {
  shape: Wave;
  cycles: number; // across the drawing
  depth: number; // 0–1
  top: Px;
  height: Px;
  tremolo?: boolean; // dips the level from the top instead of swinging about the middle
}

const lfoY = (l: Lfo, v: number) =>
  l.tremolo ? l.top + (1 - (l.depth * (v + 1)) / 2) * l.height * 0.9 + l.height * 0.05 : l.top + l.height / 2 - v * l.depth * (l.height / 2 - 4);

const lfoPoints = (width: Px, l: Lfo, flip = false) =>
  sample(width, (x) => {
    const y = lfoY(l, wave(l.shape, (x / width) * l.cycles));
    return flip ? 2 * (l.top + l.height / 2) - y : y;
  }, 1.5);

const quarters = (c: ViewContext, height: Px) =>
  [1, 2, 3].map((i) => <line key={i} className="gr" x1={(c.size.width * i) / 4} y1={0} x2={(c.size.width * i) / 4} y2={height} />);

// 11 · One bar of the movement: solid = filter (FLT MOD), dashed = volume (AMP MOD); drag the peak for DEPTH.
export function ToGuRoView(props: ViewProps) {
  const c = useViewContext(props);
  const { width: w, height: h } = c.size;
  const cycles = c.synced ? Math.min(16, 1 / (noteFraction(c.text(1)) ?? 1)) : 1 + (c.raw(1) / 127) * 10;
  const depth = c.raw(0) / 127;
  const filter: Lfo = { shape: "SIN", cycles, depth: depth * (c.raw(3) / 127), top: 10, height: h - 30 };
  const amp: Lfo = { ...filter, depth: depth * (c.raw(4) / 127) };
  return (
    <Svg size={c.size}>
      {quarters(c, h)}
      <polyline className="cv" points={lfoPoints(w, filter)} />
      <polyline className="cv2" points={lfoPoints(w, amp, true)} />
      <Handle size={c.size} x={(w * 0.25) / cycles} y={lfoY(filter, 1)} label="DEPTH" onPointerDown={c.drag({ y: { index: 0 } })} />
      <text className="gl" x={6} y={h - 6}>— filter mod  - - amp mod · 1 bar shown</text>
      <text className="gt" x={w - 6} y={h - 6} textAnchor="end">{c.synced ? c.text(1) : `RATE ${c.text(1)}`}</text>
    </Svg>
  );
}

// 29 · The modulation wave (WAVE); PAN swings it about the centre, TREMOLO dips the level. Drag for DEPTH.
export function TremoloPanView(props: ViewProps) {
  const c = useViewContext(props);
  const { width: w, height: h } = c.size;
  const pan = c.step(2) === 1;
  const shape = (c.labels(3)[c.step(3)] ?? "SIN") as Wave;
  const cycles = c.synced ? Math.max(1, Math.min(12, 1 / (parseFloat(c.text(1)) || 1))) : 2 + (c.raw(1) / 127) * 8;
  const lfo: Lfo = { shape, cycles, depth: c.raw(0) / 127, top: 14, height: h - 20, tremolo: !pan };
  const base = pan ? h / 2 + 4 : h - 6;
  const points = lfoPoints(w, lfo);
  return (
    <Svg size={c.size}>
      {quarters(c, h)}
      {pan && <line className="ax" x1={0} y1={h / 2} x2={w} y2={h / 2} />}
      {pan && <text className="gl" x={w - 4} y={18} textAnchor="end">L</text>}
      {pan && <text className="gl" x={w - 4} y={h - 6} textAnchor="end">R</text>}
      <polygon className="ar" points={`0,${base} ${points} ${w},${base}`} />
      <polyline className="cv" points={points} />
      <text className="gt" x={6} y={12}>{pan ? "PAN" : "TREMOLO"} · {shape} · {c.synced ? c.text(1) : `RATE ${c.text(1)}`}</text>
      <rect className="drag" x={0} y={14} width={w} height={h - 20} fill="transparent" onPointerDown={c.drag({ y: { index: 0 } })} />
    </Svg>
  );
}

// ---- chorus

// 23 · Two voices moving (drag up and down for DEPTH, sideways for RATE); the EQ LOW and HIGH handles below.
export function ChorusView(props: ViewProps) {
  const c = useViewContext(props);
  const { width: w, height: h } = c.size;
  const h1 = h * 0.45;
  const period = 0.33 + (c.raw(1) * 1.97) / 127;
  const voices: Lfo = { shape: "SIN", cycles: 4 / period, depth: c.raw(0) / 127, top: 4, height: h1 - 8 };
  const [lo, hi] = [Number(c.text(3)) || 0, Number(c.text(4)) || 0];
  const panel: Region = { width: w, height: h - h1 - 6, top: h1 + 4 };
  const y = dbScale(panel, 18);
  return (
    <Svg size={c.size}>
      {quarters(c, h1)}
      <polyline className="cv" points={lfoPoints(w, voices)} />
      <polyline className="cv2" points={lfoPoints(w, voices, true)} />
      <text className="gt" x={6} y={12}>RATE {c.text(1)} s · 4 s shown</text>
      <rect className="drag" x={0} y={0} width={w} height={h1} fill="transparent"
        onPointerDown={c.drag({ x: { index: 1, scale: -0.4 }, y: { index: 0 } })} />
      <Response size={panel} range={18} dbLabels={false} curve={(f) => lowShelf(f, 200, lo) + highShelf(f, 4000, hi)} />
      <Handle size={c.size} x={freqX(120, w)} y={y(lo)} label="EQ LOW" onPointerDown={c.drag({ y: { index: 3 } })} />
      <Handle size={c.size} x={freqX(8000, w)} y={y(hi)} label="EQ HIGH" onPointerDown={c.drag({ y: { index: 4 } })} />
    </Svg>
  );
}

const JUNO_LABELS = ["I", "II", "I+II", "I", "II"];
const JUNO_SPREAD = [0.5, 0.8, 1, 0.6, 0.9];

// 24 · Large chorus buttons with LEDs, as on the Juno-60 and JX-1; the rings hint at the stereo width.
export function JunoChorusView(props: ViewProps) {
  const c = useViewContext(props);
  const { width: w, height: h } = c.size;
  const mode = c.step(0);
  const bw = (w - 34) / 5;
  const sy = 40 + h * 0.32 + 16;
  const spread = JUNO_SPREAD[mode] ?? 1;
  return (
    <Svg size={c.size}>
      <text className="gt" x={8} y={16}>JUNO</text>
      <text className="gt" x={w * 0.66} y={16}>JX-1</text>
      {JUNO_LABELS.map((label, i) => {
        const x = 6 + i * bw + (i > 2 ? 16 : 0);
        return (
          <g key={i}>
            <circle cx={x + bw / 2 - 4} cy={30} r={4} fill={mode === i ? "#ff3b30" : "#3a1512"} />
            <Pad box={{ x, y: 40, w: bw - 8, h: h * 0.32 }} on={mode === i} label={label} onPick={() => c.set(0, c.starts(0)[i] ?? 0)} />
          </g>
        );
      })}
      <line className="ax" x1={w / 2} y1={sy} x2={w / 2} y2={h - 6} />
      <text className="gl" x={8} y={h - 6}>L</text>
      <text className="gl" x={w - 8} y={h - 6} textAnchor="end">R</text>
      {[0, 1, 2, 3, 4].map((k) => (
        <ellipse key={k} cx={w / 2} cy={sy + (h - sy) / 2} rx={w * 0.45 * spread * (1 - k * 0.17)} ry={((h - sy) / 2 - 4) * (1 - k * 0.15)}
          fill="none" stroke="var(--acc)" strokeOpacity={0.6 - k * 0.1} />
      ))}
    </Svg>
  );
}

// ---- flanger and phaser

function notchView(phaser: boolean) {
  return (c: ViewContext) => {
    const manual = c.raw(2) / 127;
    const res = 0.3 + (c.raw(3) / 127) * 0.65;
    const f0 = 300 * Math.pow(2, manual * (phaser ? 5 : 4));
    const comb = (f: number) => (10 * Math.log10((1 + res * res - 2 * res * Math.cos((2 * Math.PI * f) / f0)) / (1 + res * res))) * 1.6;
    const notches = (f: number) => {
      let s = 0;
      for (let k = 0; k < 4; k++) s += -18 * res * Math.exp(-Math.pow(Math.log2(f / (f0 * Math.pow(2, k * 0.9))) / 0.18, 2));
      return s + res * 6 * Math.exp(-Math.pow(Math.log2(f / (f0 * 1.4)) / 0.4, 2));
    };
    return { f0, res, curve: phaser ? notches : comb, handleHz: phaser ? f0 : f0 / 2 };
  };
}

function NotchView({ phaser, ...props }: ViewProps & { phaser: boolean }) {
  const c = useViewContext(props);
  const { f0, res, curve, handleHz } = notchView(phaser)(c);
  const sweep = (c.raw(0) / 127) * 2.5;
  const [a, b] = [freqX(f0 / Math.pow(2, sweep), c.size.width), freqX(f0 * Math.pow(2, sweep), c.size.width)];
  return (
    <Svg size={c.size}>
      <rect className="ar" x={a} y={0} width={Math.max(0, b - a)} height={c.size.height} style={{ fillOpacity: 0.1 }} />
      <Response size={c.size} range={24} curve={curve} />
      <Handle size={c.size} x={freqX(handleHz, c.size.width)} y={dbScale(c.size, 24)(-18 * res)} label="MANUAL · RESO"
        onPointerDown={c.drag({ x: { index: 2, scale: 0.6 }, y: { index: 3 } })} />
      <text className="gt" x={c.size.width - 4} y={12} textAnchor="end">RATE {c.text(1)} · DEPTH {pct(c.raw(0))}</text>
    </Svg>
  );
}

// 25 · Comb notches: MANUAL × RESO on one handle; the shaded band is the sweep (DEPTH).
export const FlangerView = (props: ViewProps) => <NotchView {...props} phaser={false} />;
// 26 · As Flanger with the four phaser notches.
export const PhaserView = (props: ViewProps) => <NotchView {...props} phaser />;

// ---- slicer

const SLICER_COLUMNS = 8;
const SPEED_BASES = ["2/1", "1/1", "1/2", "1/4", "1/8", "1/16", "1/32", "1/64"];

function PatternPads({ c, top }: { c: ViewContext; top: Px }) {
  const gw = (c.size.width - 2) / SLICER_COLUMNS;
  const pattern = c.step(0);
  return (
    <g>
      {c.labels(0).map((label, i) => (
        <Pad key={label} box={{ x: 2 + (i % SLICER_COLUMNS) * gw, y: top + Math.floor(i / SLICER_COLUMNS) * 19, w: gw - 2, h: 17 }}
          on={pattern === i} label={label} fontSize={11} onPick={() => c.set(0, c.starts(0)[i] ?? 0)} />
      ))}
    </g>
  );
}

// With SYNC on: SPEED as large note-value pads in three rows (triplet, straight, dotted).
function SpeedPads({ c, top, height }: { c: ViewContext; top: Px; height: Px }) {
  const labels = c.labels(1);
  const bw = (c.size.width - 2) / SPEED_BASES.length;
  const rh = (height - 4) / 3;
  const current = c.text(1);
  return (
    <g>
      {["T", "", "D"].flatMap((suffix, row) => SPEED_BASES.map((base, j) => {
        const name = `${base}${suffix}`;
        const k = labels.indexOf(name);
        if (k < 0) return null;
        return <Pad key={name} box={{ x: 2 + j * bw, y: top + row * (rh + 2), w: bw - 2, h: rh }} on={current === name} label={name}
          fontSize={12} onPick={() => c.set(1, c.starts(1)[k] ?? 0)} />;
      }))}
    </g>
  );
}

// With SYNC off: SPEED as a wide bar to drag.
function SpeedBar({ c, top, height }: { c: ViewContext; top: Px; height: Px }) {
  const w = c.size.width - 2;
  const v = c.raw(1) / 127;
  return (
    <g>
      <rect className="dimf" x={1} y={top} width={w} height={height} />
      <rect className="ar" x={1} y={top} width={w * v} height={height} style={{ fillOpacity: 0.5 }} />
      <line className="cv" x1={1 + w * v} y1={top} x2={1 + w * v} y2={top + height} />
      <rect className="dragx" x={0} y={top} width={c.size.width} height={height} fill="transparent" onPointerDown={c.drag({ x: { index: 1 } })}
        role="slider" aria-label="SPEED" />
    </g>
  );
}

// 28 · Compact pattern pads (4 × 8); SPEED below as large note pads (SYNC on) or a wide bar (SYNC off).
export function SlicerView(props: ViewProps) {
  const c = useViewContext(props);
  const { width: w, height: h } = c.size;
  const y0 = 16 + 4 * 19 + 8;
  const sy = y0 + 14;
  return (
    <Svg size={c.size}>
      <text className="gt" x={4} y={11}>PATTERN {c.text(0)}</text>
      <PatternPads c={c} top={16} />
      <text className="gt" x={4} y={y0 + 8}>SPEED</text>
      <text className="gt" x={w - 4} y={y0 + 8} textAnchor="end">{c.synced ? c.text(1) : `SPEED ${c.text(1)} (drag)`}</text>
      {c.synced ? <SpeedPads c={c} top={sy} height={h - sy - 2} /> : <SpeedBar c={c} top={sy} height={h - sy - 2} />}
    </Svg>
  );
}
