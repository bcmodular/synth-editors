// Drawings for the reverbs (Ha-Dou, Reverb, SX Reverb: an envelope with PRE-DELAY × LEVEL and TIME handles over
// a cut band) and the vintage simulators (303 and 404 VinylSim, Cassette Sim), from the designs.

import {
  bipolar, Caption, clamp, dbScale, freqX, Handle, highShelf, lowPass, pct, Response, sample, signed, Svg, type Px,
  type Region,
} from "./draw";
import { noise } from "./noise";
import { Band, DampBand } from "./parts";
import type { ViewProps } from "./types";
import { useViewContext, type ViewContext } from "./viewContext";

// ---- reverb envelope

interface VerbSpec {
  pre: number; // pre-delay, 0–100 ms
  time: number; // 0–1
  level: number; // 0–1
  mod?: number; // tail wobble, 0–1
  preIndex?: number; // parameters the handles move (SX Reverb has no pre-delay or level)
  levelIndex?: number;
  timeIndex: number;
}

const VERB_TOP = 16;

function Envelope({ c, spec, base }: { c: ViewContext; spec: VerbSpec; base: Px }) {
  const w = c.size.width;
  const span = base - VERB_TOP;
  const x0 = 14 + (spec.pre / 100) * 56;
  const len = 24 + spec.time * (w - x0 - 20);
  const level = (x: Px) => spec.level * Math.exp((-3 * (x - x0)) / len) * (1 + (spec.mod ?? 0) * 0.25 * Math.sin(x * 0.35) * Math.sin(x * 0.05));
  const tail: string[] = [];
  for (let x = x0; x <= w; x += 2) tail.push(`${x.toFixed(1)},${(base - clamp(level(x), 0, 1) * span).toFixed(1)}`);
  const xt = x0 + len * 0.75;
  return (
    <g>
      {Array.from({ length: Math.ceil((w - 8) / 32) }, (_, i) => <line key={i} className="gr" x1={8 + i * 32} y1={VERB_TOP} x2={8 + i * 32} y2={base} />)}
      <line className="ax" x1={0} y1={base} x2={w} y2={base} />
      <rect className="af" x={6} y={VERB_TOP} width={3} height={span} opacity={0.7} />
      <text className="gl" x={11} y={VERB_TOP + 8}>DRY</text>
      <polygon className="ar" points={[`${x0},${base}`, ...tail, `${w},${base}`].join(" ")} style={{ fillOpacity: 0.35 }} />
      <polyline className="cv" points={tail.join(" ")} style={{ strokeWidth: 1.4 }} />
      {spec.preIndex !== undefined && (
        <>
          <line className="cv2" x1={9} y1={VERB_TOP + span / 2} x2={x0} y2={VERB_TOP + span / 2} />
          <text className="gl" x={(9 + x0) / 2} y={VERB_TOP + span / 2 - 4} textAnchor="middle">PRE {Math.round(spec.pre)}</text>
          <Handle size={c.size} x={x0} y={base - spec.level * span} label="PRE · LVL"
            onPointerDown={c.drag({ x: { index: spec.preIndex, scale: 0.9 }, y: spec.levelIndex === undefined ? undefined : { index: spec.levelIndex } })} />
        </>
      )}
      <Handle size={c.size} x={xt} y={base - spec.level * Math.exp(-2.25) * span} label="TIME"
        onPointerDown={c.drag({ x: { index: spec.timeIndex } })} />
    </g>
  );
}

const preMs = (c: ViewContext) => Math.round((c.raw(5) / 127) * 100);

// A room reverb: front corner PRE-DELAY × LEVEL, tail TIME (`stretch` lengthens it), the cut band below.
function RoomView({ caption, stretch, mod, ...props }: ViewProps & { caption: (c: ViewContext) => string;
  stretch: (c: ViewContext) => number; mod?: (c: ViewContext) => number }) {
  const c = useViewContext(props);
  const spec: VerbSpec = {
    pre: preMs(c), time: Math.min(1, (c.raw(1) / 127) * stretch(c)), level: 0.3 + (c.raw(2) / 127) * 0.7, mod: mod?.(c),
    preIndex: 5, levelIndex: 2, timeIndex: 1,
  };
  return (
    <Svg size={c.size}>
      <Envelope c={c} spec={spec} base={c.size.height - 22} />
      <DampBand c={c} y={c.size.height - 17} lo={3} hi={4} label="CUT" />
      <Caption size={c.size}>{caption(c)}</Caption>
    </Svg>
  );
}

// 8 · MOD DEPTH makes the tail wobble.
export const HaDouView = (props: ViewProps) => (
  <RoomView {...props} stretch={() => 1} mod={(c) => c.raw(0) / 127} caption={(c) => `MOD ${pct(c.raw(0))}`} />
);

// 22 · TYPE (AMBI … HALL2) lengthens the drawn tail.
export const ReverbView = (props: ViewProps) => (
  <RoomView {...props} stretch={(c) => 0.5 + c.step(0) * 0.2} caption={(c) => c.text(0)} />
);

// 38 · Tail TIME only; TONE darkens or brightens it, shown as the band (either edge drags TONE).
export function SxReverbView(props: ViewProps) {
  const c = useViewContext(props);
  const tone = bipolar(c.raw(1)) / 100;
  return (
    <Svg size={c.size}>
      <Envelope c={c} spec={{ pre: 8, time: c.raw(0) / 127, level: 0.85, timeIndex: 0 }} base={c.size.height - 22} />
      <Band c={c} y={c.size.height - 17} lo={tone > 0 ? 60 + tone * 400 : undefined} hi={tone < 0 ? 16000 * Math.pow(2, tone * 4) : undefined}
        loIndex={1} hiIndex={1} label={`TONE ${signed(bipolar(c.raw(1)))}`} />
    </Svg>
  );
}

// ---- vinyl

function Record({ c, cx, cy, r }: { c: ViewContext; cx: Px; cy: Px; r: Px }) {
  const wow = c.raw(2) / 127;
  const groove = (k: number) => {
    const rr = r * (0.32 + k * 0.05);
    const pts: string[] = [];
    for (let a = 0; a <= 6.3; a += 0.06) {
      const q = rr * (1 + wow * (0.06 * Math.sin(3 * a + k * 0.7) + 0.035 * Math.sin(7 * a + k * 1.9) + 0.02 * Math.sin(13 * a + k)));
      pts.push(`${(cx + Math.cos(a) * q).toFixed(1)},${(cy + Math.sin(a) * q).toFixed(1)}`);
    }
    return pts.join(" ");
  };
  const crackle = Math.round((c.raw(1) / 127) * 90);
  return (
    <g>
      {Array.from({ length: 14 }, (_, k) => (
        <polygon key={k} points={groove(k)} fill="none" stroke={k % 3 ? "#2c2e34" : "#41444c"} strokeWidth={k % 3 ? 1 : 1.4} />
      ))}
      <circle className="af" cx={cx} cy={cy} r={r * 0.28} opacity={0.8} />
      <text className="padt" x={cx} y={cy + 4} textAnchor="middle" style={{ fill: "#000" }}>303</text>
      {Array.from({ length: crackle }, (_, i) => {
        const a = noise(i) * 6.283;
        const rr = r * (0.3 + 0.7 * noise(i + 50));
        return <circle key={i} cx={cx + Math.cos(a) * rr} cy={cy + Math.sin(a) * rr} r={1} fill="#e8e8ea" opacity={0.6} />;
      })}
      <rect className="drag" x={cx - r} y={cy - r} width={2 * r} height={2 * r} fill="transparent"
        onPointerDown={c.drag({ x: { index: 2, scale: 0.6 }, y: { index: 1 } })} />
    </g>
  );
}

// 18 · A record: crackle for NOISE, grooves wobbling with WOW FLUT, and a COMP bar on the right.
export function VinylSim303View(props: ViewProps) {
  const c = useViewContext(props);
  const { width: w, height: h } = c.size;
  const [mx, mt, mb] = [w - 30, 14, h - 20];
  const comp = c.raw(0) / 127;
  return (
    <Svg size={c.size}>
      <Record c={c} cx={w * 0.42} cy={h / 2} r={Math.min(h / 2 - 8, w * 0.36)} />
      <rect className="dimf" x={mx} y={mt} width={14} height={mb - mt} />
      <rect className="af" x={mx} y={mb - (mb - mt) * comp} width={14} height={(mb - mt) * comp} opacity={0.7} />
      <text className="gl" x={mx + 7} y={h - 6} textAnchor="middle">COMP</text>
      <rect className="drag" x={mx - 6} y={mt} width={26} height={mb - mt} fill="transparent" onPointerDown={c.drag({ y: { index: 0 } })} />
      <text className="gt" x={6} y={12}>NOISE {pct(c.raw(1))} · WOW {pct(c.raw(2))}</text>
    </Svg>
  );
}

// 19 · Band-limited response (FREQ narrows it) with the noise floor (NOISE) wobbling with WOW FLUT.
export function VinylSim404View(props: ViewProps) {
  const c = useViewContext(props);
  const f = c.raw(0) / 127;
  const [lo, hi] = [40 + (1 - f) * 500, 2500 + f * 14000];
  const y = dbScale(c.size, 30);
  const floor = y(-30 + (c.raw(1) / 127) * 24);
  const wobble = (c.raw(2) / 127) * 6;
  return (
    <Svg size={c.size}>
      <Response size={c.size} range={30} curve={(x) => lowPass(x / hi, 0.7) + lowPass(lo / x, 0.7)} />
      <polyline className="cv2" points={sample(c.size.width, (x) => floor + Math.sin(x * 0.08) * wobble)} />
      <Handle size={c.size} x={freqX(hi, c.size.width)} y={y(-3)} label="FREQ" onPointerDown={c.drag({ x: { index: 0, scale: 0.4 } })} />
      <Handle size={c.size} x={c.size.width * 0.5} y={floor} label="NOISE" onPointerDown={c.drag({ y: { index: 1 } })} />
      <Caption size={c.size}>WOW {pct(c.raw(2))}</Caption>
    </Svg>
  );
}

// ---- cassette

interface Tape {
  age: number; // 0–1
  hiss: number;
  wow: number;
  drive: number;
  tone: number; // −1…1
  drops: Px[];
}

// A sawtooth built from harmonics; AGE takes the upper ones away, `tilt` lifts or cuts them.
const saw = (a: number, age: number, tilt: number) => {
  let v = 0;
  for (let k = 1; k <= 24; k++) v += (Math.sin(k * a) / k) * Math.exp(-(k - 1) * age * 0.9) * (k > 3 ? 1 + tilt : 1);
  return v / 1.7;
};

function tapeOut(t: Tape, x: Px, width: Px): number {
  const a0 = (x / width) * 2 * Math.PI * 3;
  let v = saw(a0 + t.wow * 1.4 * Math.sin(x * 0.045), t.age, t.tone * 0.5);
  if (t.drive > 0) v = Math.tanh(t.drive * v) / Math.tanh(t.drive);
  v *= 1 - t.age * 0.25;
  if (t.drops.some((d) => x > d && x < d + 9)) v *= 0.15;
  return v + (noise(x * 3.7) - 0.5) * t.hiss * 0.25;
}

function TapeSignal({ c, t, top }: { c: ViewContext; t: Tape; top: Region }) {
  const w = c.size.width;
  const mid = top.height / 2 + 8;
  const amp = top.height / 2 - 12;
  return (
    <g>
      <rect className="dimf" x={0} y={4} width={w} height={top.height} fillOpacity={0.3} />
      <line className="ax" x1={0} y1={mid} x2={w} y2={mid} />
      {Array.from({ length: Math.round(t.hiss * 320) }, (_, i) => (
        <circle key={i} cx={noise(i + 500) * w} cy={mid + (noise(i + 900) - 0.5) * amp * 2 * (0.3 + 0.7 * t.hiss)} r={0.9}
          fill="#c9ccd3" opacity={0.15 + 0.45 * noise(i + 77)} />
      ))}
      <polyline className="cv2" style={{ strokeOpacity: 0.45 }} points={sample(w, (x) => mid - saw((x / w) * 2 * Math.PI * 3, 0, 0) * amp, 1.5)} />
      <polyline className="cv" style={{ strokeWidth: 1.6 }} points={sample(w, (x) => mid - tapeOut(t, x, w) * amp, 1.5)} />
      <text className="gl" x={w - 4} y={top.height} textAnchor="end">- - input   — output</text>
      <rect className="drag" x={0} y={4} width={w} height={top.height} fill="transparent"
        onPointerDown={c.drag({ x: { index: 2 }, y: { index: 1, scale: 0.6 } })} />
    </g>
  );
}

// 20 · A sawtooth (dashed) and the tape's version of it (solid); the response with a TONE handle below.
export function CassetteSimView(props: ViewProps) {
  const c = useViewContext(props);
  const { width: w, height: h } = c.size;
  const h1 = h * 0.55;
  const t: Tape = {
    age: Number(c.text(2)) / 60, hiss: c.raw(1) / 127, wow: c.raw(4) / 127, drive: (c.raw(3) / 127) * 3,
    tone: (c.raw(0) - 64) / 64, drops: Array.from({ length: Math.round((c.raw(5) / 127) * 6) }, (_, k) => w * (0.08 + 0.84 * noise(k + 40))),
  };
  const fc = 16000 / Math.pow(2, t.age * 3.5);
  const tone = t.tone * 8;
  const panel: Region = { width: w, height: h - h1 - 10, top: h1 + 8 };
  const curve = (f: number) => lowPass(f / fc, 0.8) + highShelf(f, 2500, tone);
  return (
    <Svg size={c.size}>
      <TapeSignal c={c} t={t} top={{ width: w, height: h1 }} />
      <text className="gt" x={6} y={16}>AGE {c.text(2)} · HISS {pct(c.raw(1))} · WOW {pct(c.raw(4))} · DRIVE {pct(c.raw(3))}</text>
      <Response size={panel} range={24} dbLabels={false} curve={curve} />
      <text className="gt" x={4} y={h1 + 20}>TONE</text>
      <Handle size={c.size} x={freqX(6000, w)} y={dbScale(panel, 24)(curve(6000))} label={`TONE ${signed(Math.round(t.tone * 100))}`}
        onPointerDown={c.drag({ y: { index: 0, scale: 0.6 } })} />
    </Svg>
  );
}
