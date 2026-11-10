// Drawings for the Drive & character effects, from the designs: transfer curves over tone panels (WrmSaturator,
// Overdrive, Distortion), sines and their crushed copies (Lo-fi, Crusher), the ring mod carrier, the compressor's
// transfer curve and attack, and Gt Amp Sim's amp buttons over its tone stack.

import {
  bipolar, Caption, clamp, dbScale, freqX, Handle, highShelf, lowPass, lowShelf, pct, peak, Response, sample, signed,
  Svg, xFreq, type Db, type Hz, type Px, type Region,
} from "./draw";
import type { ViewProps } from "./types";
import { parseHz, useViewContext, type ViewContext } from "./viewContext";

const db48 = (raw: number) => Math.floor((raw / 127.5) * 49);
const db24 = (raw: number) => db48(raw) - 24;

// ---- shared parts

// Output against input (−1…1); drag up or down on it for parameter `driveIndex`.
function Transfer({ c, region, shape }: { c: ViewContext; region: Region; shape: (v: number) => number }) {
  const { width: w, height: h, top = 0 } = region;
  const y = (v: number) => top + h / 2 - shape(v) * (h / 2 - 4);
  const points = sample(w, (x) => y((x / w) * 2 - 1), w / 80);
  return (
    <g>
      <rect className="dimf" x={0} y={top} width={w} height={h} fillOpacity={0.3} />
      <line className="cv2" x1={0} y1={top + h} x2={w} y2={top} />
      <line className="gr" x1={0} y1={top + h / 2} x2={w} y2={top + h / 2} />
      <line className="gr" x1={w / 2} y1={top} x2={w / 2} y2={top + h} />
      <polyline className="cv" points={points} />
      <text className="gl" x={3} y={top + 10}>OUT</text>
      <text className="gl" x={w - 3} y={top + h - 3} textAnchor="end">IN</text>
      <rect className="drag" x={0} y={top} width={w} height={h} fill="transparent" onPointerDown={c.drag({ y: { index: 0 } })} />
    </g>
  );
}

interface ToneHandle {
  hz: Hz;
  db: Db;
  label: string;
  index: number;
}

// A tone curve in its own band, with handles dragged up and down.
function TonePanel({ c, region, curve, handles }: { c: ViewContext; region: Region; curve: (f: Hz) => Db; handles: ToneHandle[] }) {
  const { width: w, height: h, top = 0 } = region;
  const y = (d: Db) => top + h / 2 - (clamp(d, -24, 24) / 24) * (h / 2 - 8);
  return (
    <g>
      <rect className="dimf" x={0} y={top} width={w} height={h} fillOpacity={0.3} />
      <line className="ax" x1={0} y1={y(0)} x2={w} y2={y(0)} />
      <polyline className="cv" points={sample(w, (x) => y(curve(xFreq(x, w))))} />
      <text className="gl" x={3} y={top + 10}>TONE</text>
      {handles.map((t) => (
        <Handle key={t.label} size={c.size} x={freqX(t.hz, w)} y={y(t.db)} label={t.label}
          onPointerDown={c.drag({ y: { index: t.index } })} />
      ))}
    </g>
  );
}

const halves = (c: ViewContext): [Region, Region] => {
  const h1 = c.size.height * 0.56;
  return [{ width: c.size.width, height: h1 - 4, top: 0 }, { width: c.size.width, height: c.size.height - h1 - 2, top: h1 + 2 }];
};

// ---- drive and saturation

// 17 · Saturation curve (drag for DRIVE) over LOW and HIGH tone handles.
export function WrmSaturatorView(props: ViewProps) {
  const c = useViewContext(props);
  const drive = 0.5 + db48(c.raw(0)) / 6;
  const [lo, hi] = [db24(c.raw(1)), db24(c.raw(2))];
  const [top, bottom] = halves(c);
  return (
    <Svg size={c.size}>
      <Transfer c={c} region={top} shape={(v) => Math.tanh(v * drive) / Math.tanh(drive)} />
      <text className="gt" x={c.size.width / 2} y={top.height - 10} textAnchor="middle">DRIVE +{db48(c.raw(0))} dB</text>
      <TonePanel c={c} region={bottom} curve={(f) => lowShelf(f, 200, lo) + highShelf(f, 4000, hi)}
        handles={[{ hz: 150, db: lo, label: `LOW ${signed(lo)}`, index: 1 }, { hz: 7000, db: hi, label: `HIGH ${signed(hi)}`, index: 2 }]} />
    </Svg>
  );
}

function DriveView({ hard, ...props }: ViewProps & { hard: boolean }) {
    const c = useViewContext(props);
    const drive = 0.6 + (c.raw(0) / 127) * (hard ? 12 : 5);
    const tone = (bipolar(c.raw(1)) / 100) * 12;
    const shape = (v: number) => (hard ? clamp(v * drive, -1, 1) * 0.9 + 0.1 * Math.tanh(v * drive) : Math.tanh(v * drive) / Math.tanh(drive));
    const [top, bottom] = halves(c);
    return (
      <Svg size={c.size}>
        <Transfer c={c} region={top} shape={shape} />
        <text className="gt" x={c.size.width / 2} y={top.height - 10} textAnchor="middle">DRIVE {pct(c.raw(0))}</text>
        <TonePanel c={c} region={bottom} curve={(f) => tone * (Math.log2(f / 1000) / 5)}
          handles={[{ hz: 8000, db: (tone * 3) / 5, label: `TONE ${signed(bipolar(c.raw(1)))}`, index: 1 }]} />
      </Svg>
    );
}

// 34 · Soft clipping; 35 · harder clipping. Both over a tone tilt with one handle.
export const OverdriveView = (props: ViewProps) => <DriveView {...props} hard={false} />;
export const DistortionView = (props: ViewProps) => <DriveView {...props} hard />;

// ---- sample crushing

// A sine and its stepped copy: `stepPx` wide stairs at `levels` levels, in the top `height` px.
function Crushed({ width, height, cycles, stepPx, levels }: { width: Px; height: Px; cycles: number; stepPx: Px; levels?: number }) {
  const y = (v: number) => height / 2 + 4 - v * (height / 2 - 6);
  const sine = (x: Px) => Math.sin((x / width) * Math.PI * cycles);
  const stairs: string[] = [];
  for (let x = 0; x <= width; x += stepPx) {
    const v = levels ? Math.round(sine(x) * levels) / levels : sine(x);
    stairs.push(`${x.toFixed(1)},${y(v).toFixed(1)}`, `${(x + stepPx).toFixed(1)},${y(v).toFixed(1)}`);
  }
  return (
    <g>
      <polyline className="cv2" points={sample(width, (x) => y(sine(x)))} />
      <polyline className="cv" points={stairs.join(" ")} />
    </g>
  );
}

// 21 · A sine against its crushed copy (LOFI TYPE), over the filter with a CUTOFF handle tilted by TONE.
export function LofiView(props: ViewProps) {
  const c = useViewContext(props);
  const { width, height } = c.size;
  const h1 = height * 0.45;
  const type = c.step(1);
  const fc = parseHz(c.text(3)) ?? 2000;
  const tone = (bipolar(c.raw(2)) / 100) * 8;
  const panel: Region = { width, height: height - h1 - 8, top: h1 + 6 };
  return (
    <Svg size={c.size}>
      <Crushed width={width} height={h1} cycles={4} stepPx={width / (10 + (8 - type) * 8)} levels={4 + (8 - type) * 3} />
      <text className="gt" x={6} y={12}>TYPE {c.text(1)} · PRE {c.text(0)}</text>
      <Response size={panel} range={24} dbLabels={false} curve={(f) => lowPass(f / fc, 0.9) + highShelf(f, 2000, tone)} />
      <Handle size={c.size} x={freqX(fc, width)} y={dbScale(panel, 24)(-3)} label="CUTOFF"
        onPointerDown={c.drag({ x: { index: 3, scale: 0.3 } })} />
    </Svg>
  );
}

const CRUSHER_HZ = (raw: number) => 331 * Math.pow(15392 / 331, raw / 127);

// 33 · A staircase over a sine (drag the top for RATE) and the FILTER handle.
export function CrusherView(props: ViewProps) {
  const c = useViewContext(props);
  const { width, height } = c.size;
  const h1 = height * 0.5;
  const fc = CRUSHER_HZ(c.raw(0));
  const panel: Region = { width, height: height - h1 - 6, top: h1 + 4 };
  return (
    <Svg size={c.size}>
      <Crushed width={width} height={h1 - 4} cycles={3} stepPx={2 + (c.raw(1) / 127) * 22} />
      <rect className="dragx" x={0} y={0} width={width} height={h1} fill="transparent" onPointerDown={c.drag({ x: { index: 1 } })} />
      <text className="gt" x={6} y={12}>RATE {pct(c.raw(1))} (drag)</text>
      <Response size={panel} range={24} dbLabels={false} curve={(f) => lowPass(f / fc, 0.8)} />
      <Handle size={c.size} x={freqX(fc, width)} y={dbScale(panel, 24)(-3)} label="FILTER"
        onPointerDown={c.drag({ x: { index: 0 } })} />
    </Svg>
  );
}

// 32 · The carrier inside the input envelope: FREQUENCY sideways, SENS up and down; POLARITY flips it.
export function RingModView(props: ViewProps) {
  const c = useViewContext(props);
  const { width, height } = c.size;
  const mid = height / 2;
  const cycles = 2 + (c.raw(0) / 127) * 30;
  const sens = c.raw(1) / 127;
  const flip = c.step(3) === 1 ? 1 : -1;
  const env = (x: Px) => Math.exp((-x / width) * 2.2) * (0.5 + 0.5 * sens) * (mid - 12);
  return (
    <Svg size={c.size}>
      <line className="ax" x1={0} y1={mid} x2={width} y2={mid} />
      <polyline className="cv2" points={sample(width, (x) => mid - env(x), 1)} />
      <polyline className="cv" style={{ strokeWidth: 1.3 }}
        points={sample(width, (x) => mid - env(x) * Math.sin((x / width) * cycles * 2 * Math.PI) * flip, 1)} />
      <Handle size={c.size} x={width * 0.5} y={mid - env(width * 0.5)} label="FREQ · SENS"
        onPointerDown={c.drag({ x: { index: 0, scale: 0.4 }, y: { index: 1 } })} />
      <text className="gt" x={6} y={12}>FREQ {pct(c.raw(0))} · SENS {pct(c.raw(1))}</text>
    </Svg>
  );
}

// ---- compressor

// The gain reduction over time after a hit, for ATTACK (0–1).
function AttackStrip({ c, top }: { c: ViewContext; top: Px }) {
  const w = c.size.width - 4;
  const h = c.size.height - top - 20;
  const attack = c.raw(1) / 127;
  const level = (t: number) => (t < 0.15 ? 1 : 1 - 0.6 * (1 - Math.exp(-(t - 0.15) / (0.02 + attack * 0.3))));
  return (
    <g>
      <rect className="dimf" x={2} y={top} width={w} height={h + 12} fillOpacity={0.3} />
      <polyline className="cv" points={sample(w, (x) => top + 6 + (1 - level(x / w)) * h)} transform="translate(2 0)" />
      <text className="gl" x={w - 2} y={top + h + 8} textAnchor="end">ATTACK {pct(c.raw(1))} (drag sideways)</text>
      <rect className="dragx" x={2} y={top} width={w} height={h + 12} fill="transparent" onPointerDown={c.drag({ x: { index: 1, scale: 0.6 } })} />
    </g>
  );
}

// 37 · Transfer curve with THRESH (SUSTAIN) and RATIO handles, the ATTACK strip below. The dB mapping is a guess.
export function CompressorView(props: ViewProps) {
  const c = useViewContext(props);
  const side = Math.min(c.size.width - 8, c.size.height * 0.66);
  const x0 = (c.size.width - side) / 2;
  const thresh = -4 - (c.raw(0) / 127) * 40;
  const ratio = 1 + (c.raw(2) / 127) * 15;
  const makeup = (c.raw(3) / 127 - 0.7) * 12;
  const m = (d: Db) => ((d + 60) / 60) * side;
  const out = (d: Db) => (d < thresh ? d : thresh + (d - thresh) / ratio) + makeup;
  const curve: string[] = [];
  for (let d = -60; d <= 0; d += 1) curve.push(`${(x0 + m(d)).toFixed(1)},${(4 + side - clamp(m(out(d)), 0, side)).toFixed(1)}`);
  return (
    <Svg size={c.size}>
      <rect className="dimf" x={x0} y={4} width={side} height={side} fillOpacity={0.3} />
      <line className="cv2" x1={x0} y1={4 + side} x2={x0 + side} y2={4} />
      <polyline className="cv" points={curve.join(" ")} />
      <Handle size={c.size} x={x0 + m(thresh)} y={4 + side - m(thresh + makeup)} label="THRESH"
        onPointerDown={c.drag({ x: { index: 0, scale: -0.8 } })} />
      <Handle size={c.size} x={x0 + side - 6} y={4 + side - clamp(m(out(0)), 0, side)} label="RATIO"
        onPointerDown={c.drag({ y: { index: 2, scale: -1 } })} />
      <text className="gt" x={x0 + 4} y={16}>SUSTAIN {pct(c.raw(0))} · RATIO {pct(c.raw(2))}</text>
      <AttackStrip c={c} top={4 + side + 6} />
    </Svg>
  );
}

// ---- amp simulator

const AMP_NAMES = ["JC-120 Jazz Chorus", "Twin Reverb", "Boogie Lead", "Matchless", "Marshall 1959", "Soldano SLO"];
const AMP_STARTS = [0, 22, 43, 64, 85, 107];
const AMP_ROW = 28;

function AmpButtons({ c }: { c: ViewContext }) {
  const w = c.size.width;
  const chosen = c.step(0);
  return (
    <g>
      {AMP_NAMES.map((name, i) => {
        const x = 2 + (i % 2) * (w / 2);
        const y = 2 + Math.floor(i / 2) * (AMP_ROW + 3);
        return (
          <g key={name} className={`amp ${chosen === i ? "on" : ""}`} role="button" aria-label={name} aria-pressed={chosen === i}
            onClick={() => c.set(0, AMP_STARTS[i]!)}>
            <rect className="pad" x={x} y={y} width={w / 2 - 4} height={AMP_ROW} rx={3} />
            <text className="padt" x={x + w / 4 - 2} y={y + AMP_ROW / 2 + 4} textAnchor="middle">{name}</text>
          </g>
        );
      })}
    </g>
  );
}

// 46 · Six large amp buttons with their full names; the tone stack with BASS, MID and TREBLE handles.
export function GtAmpSimView(props: ViewProps) {
  const c = useViewContext(props);
  const [b, m, t] = [3, 4, 5].map((i) => (bipolar(c.raw(i)) / 100) * 12) as [Db, Db, Db];
  const top = AMP_ROW * 3 + 8;
  const panel: Region = { width: c.size.width, height: c.size.height - top - 4, top: top + 2 };
  const y = dbScale(panel, 18);
  const handles: [string, Hz, Db, number][] = [["BASS", 120, b, 3], ["MID", 700, m, 4], ["TREBLE", 3200, t, 5]];
  return (
    <Svg size={c.size}>
      <AmpButtons c={c} />
      <Response size={panel} range={18} dbLabels={false} curve={(f) => lowShelf(f, 120, b) + peak(f, 700, m, 1.1) + highShelf(f, 3200, t)} />
      <Caption size={{ width: c.size.width, height: top + 14 }}>
        <tspan y={top + 14}>DRIVE {pct(c.raw(1))} · LEVEL {pct(c.raw(2))}</tspan>
      </Caption>
      {handles.map(([name, hz, db, i]) => (
        <Handle key={name} size={c.size} x={freqX(hz, c.size.width)} y={y(db)} label={name} onPointerDown={c.drag({ y: { index: i } })} />
      ))}
    </Svg>
  );
}
