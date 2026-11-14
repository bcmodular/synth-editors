// Drawings for the dynamics and character effects (after the SP-404's drive views): the compressor's transfer curve
// over its attack and release, the ring mod's carrier, and the bit crusher's stepped sine over its filter.
import { compOut } from "../../core/efxShapes";
import { Caption, clamp, DragArea, freqX, Handle, lowPass, sample, Svg, Well } from "../../ui/draw";
import type { Hz, Px, Region } from "../../ui/draw";
import { split, TonePanel } from "./parts";
import { useEfxView } from "./viewContext";
import type { EfxView, EfxViewProps } from "./viewContext";

// ---- compressor

export const COMP = { attack: 0x02, release: 0x03, threshold: 0x04, ratio: 0x05, knee: 0x06, gain: 0x07 } as const;
const C = COMP;
const FLOOR_DB = -60;

function Transfer({ c, region }: { c: EfxView; region: Region }) {
  const { width: w, height: h, top = 0 } = region;
  const s = { threshold: c.raw(C.threshold), ratio: c.raw(C.ratio), knee: c.raw(C.knee), gain: c.raw(C.gain) };
  const x = (db: number): Px => ((db - FLOOR_DB) / -FLOOR_DB) * w;
  const y = (db: number): Px => top + h - clamp((db - FLOOR_DB) / -FLOOR_DB, 0, 1) * (h - 4) - 2;
  const curve = (px: Px) => y(compOut(s, FLOOR_DB + (px / w) * -FLOOR_DB));
  const t = s.threshold - 40;
  return (
    <g>
      <Well region={region} />
      {[-48, -36, -24, -12].map((db) => (
        <line key={db} className="grid" x1={x(db)} y1={top} x2={x(db)} y2={top + h} />
      ))}
      <line className="trace2" x1={0} y1={y(FLOOR_DB)} x2={w} y2={y(0)} />
      <polyline className="trace" points={sample(w, curve)} />
      <Caption region={region}>{`${c.text(C.ratio)} · ${c.text(C.knee).toUpperCase()}`}</Caption>
      <Handle size={c.size} x={x(t)} y={curve(x(t))} label="THRESHOLD" below
        onPointerDown={c.drag({ x: { offset: C.threshold, px: 160 }, y: { offset: C.gain, px: 240 } })}
        onReset={c.reset(C.threshold, C.gain)} />
      <Handle size={c.size} x={w - 8} y={curve(w)} label="RATIO" cursor="ns-resize"
        onPointerDown={c.drag({ y: { offset: C.ratio, px: -110 } })} onReset={c.reset(C.ratio)} />
    </g>
  );
}

const HIT = 0.08; // where the loud note starts and stops, across the strip
const LET_GO = 0.55;

// Gain reduction after a loud note (dips with ATTACK) and after it ends (recovers with RELEASE).
function Envelope({ c, region }: { c: EfxView; region: Region }) {
  const { width: w, height: h, top = 0 } = region;
  const a = 0.01 + (c.raw(C.attack) / 124) * 0.3;
  const r = 0.02 + (c.raw(C.release) / 124) * 0.4;
  const atRelease = 1 - Math.exp(-(LET_GO - HIT) / a);
  const gr = (t: number) => {
    if (t < HIT) return 0;
    if (t < LET_GO) return 1 - Math.exp(-(t - HIT) / a);
    return atRelease * Math.exp(-(t - LET_GO) / r);
  };
  const y = (v: number) => top + 3 + v * (h - 8);
  return (
    <g>
      <Well region={region} />
      <line className="grid" x1={HIT * w} y1={top} x2={HIT * w} y2={top + h} />
      <line className="grid" x1={LET_GO * w} y1={top} x2={LET_GO * w} y2={top + h} />
      <polyline className="trace" points={sample(w, (px) => y(gr(px / w)), 1)} />
      <Handle size={c.size} x={(HIT + a) * w} y={y(gr(HIT + a))} label="ATTACK" cursor="ew-resize"
        onPointerDown={c.drag({ x: { offset: C.attack, px: 160 } })} onReset={c.reset(C.attack)} />
      <Handle size={c.size} x={Math.min(LET_GO + r, 0.98) * w} y={y(gr(LET_GO + r))} label="RELEASE" cursor="ew-resize"
        onPointerDown={c.drag({ x: { offset: C.release, px: 160 } })} onReset={c.reset(C.release)} />
    </g>
  );
}

// Output against input (−60…0 dB): THRESHOLD sideways (up and down for GAIN), RATIO at the top; the gain
// reduction below with ATTACK and RELEASE.
export function CompView(props: EfxViewProps) {
  const c = useEfxView(props);
  const [main, strip] = split(c, 40);
  return (
    <Svg size={c.size} label="COMP">
      <Transfer c={c} region={main} />
      <Envelope c={c} region={strip} />
    </Svg>
  );
}

export const COMP_IN_VIEW = [C.threshold, C.gain, C.ratio, C.attack, C.release];

// ---- ring mod

export const RING = { freq: 0x0a, sens: 0x0b, dir: 0x0c, low: 0x0d, high: 0x0e } as const;
const RM = RING;

// The carrier under a dying note: FREQ sets its pitch, SENS how far the note's level bends it (UP or DOWN).
function Carrier({ c, region }: { c: EfxView; region: Region }) {
  const { width: w, height: h, top = 0 } = region;
  const mid = top + h / 2;
  const env = (px: Px) => Math.exp((-px / w) * 2.2);
  const cycles = 3 + (c.raw(RM.freq) / 127) * 22;
  const bend = (c.raw(RM.sens) / 127) * (c.raw(RM.dir) === 0 ? 1 : -0.7);
  const points: string[] = [];
  let phase = 0;
  for (let px = 0; px <= w; px++) {
    phase += (cycles / w) * (1 + bend * env(px));
    points.push(`${px},${(mid - env(px) * (h / 2 - 6) * Math.sin(phase * 2 * Math.PI)).toFixed(1)}`);
  }
  return (
    <g>
      <Well region={region} />
      <line className="axis" x1={0} y1={mid} x2={w} y2={mid} />
      <polyline className="trace2" points={sample(w, (px) => mid - env(px) * (h / 2 - 6))} />
      <polyline className="trace" style={{ strokeWidth: 1.3 }} points={points.join(" ")} />
      <Handle size={c.size} x={w * 0.5} y={mid - env(w * 0.5) * (h / 2 - 6)} label="FREQ · SENS"
        onPointerDown={c.drag({ x: { offset: RM.freq, px: 200 }, y: { offset: RM.sens, px: 160 } })}
        onReset={c.reset(RM.freq, RM.sens)} />
    </g>
  );
}

// The carrier (FREQ sideways, SENS up and down on one handle) over the EQ LOW / HIGH shelves.
export function RingModView(props: EfxViewProps) {
  const c = useEfxView(props);
  const [main, tone] = split(c, c.size.height * 0.42);
  return (
    <Svg size={c.size} label="RING MOD">
      <Carrier c={c} region={main} />
      <TonePanel c={c} region={tone} low={RM.low} high={RM.high} />
    </Svg>
  );
}

export const RING_IN_VIEW = [RM.freq, RM.sens, RM.low, RM.high];

// ---- bit crush

export const CRUSH = { filter: 0x12, rate: 0x13, low: 0x15, high: 0x16 } as const;
const BC = CRUSH;
const filterHz = (raw: number): Hz => 200 * Math.pow(2, (raw / 127) * 6.5); // 200 Hz … 18 kHz (a guess)

// A sine (dashed) and its sampled copy: stairs widen as SAMP RATE goes up.
function Crushed({ c, region }: { c: EfxView; region: Region }) {
  const { width: w, height: h, top = 0 } = region;
  const y = (v: number) => top + h / 2 - v * (h / 2 - 6);
  const sine = (px: Px) => Math.sin((px / w) * Math.PI * 6);
  const step = 2 + (c.raw(BC.rate) / 127) * 22;
  const stairs: string[] = [];
  for (let px = 0; px <= w; px += step) {
    const v = y(sine(px)).toFixed(1);
    stairs.push(`${px.toFixed(1)},${v}`, `${Math.min(px + step, w).toFixed(1)},${v}`);
  }
  return (
    <g>
      <Well region={region} />
      <polyline className="trace2" points={sample(w, (px) => y(sine(px)))} />
      <polyline className="trace" points={stairs.join(" ")} />
      <Caption region={region}>{`SAMP RATE ${c.raw(BC.rate)}`}</Caption>
      <DragArea region={region} cursor="ew-resize" label={c.name(BC.rate)}
        onPointerDown={c.drag({ x: { offset: BC.rate, px: 200 } })} />
    </g>
  );
}

// The stepped sine (drag sideways for SAMP RATE) over the filter (FILTER handle) and EQ LOW / HIGH shelves.
export function BitCrushView(props: EfxViewProps) {
  const c = useEfxView(props);
  const [main, tone] = split(c, c.size.height * 0.5);
  const fc = filterHz(c.raw(BC.filter));
  const lp = (f: Hz) => Math.max(-24, lowPass(f / fc));
  return (
    <Svg size={c.size} label="BIT CRUSH">
      <Crushed c={c} region={main} />
      <TonePanel c={c} region={tone} low={BC.low} high={BC.high} extra={lp} />
      <Handle size={c.size} x={freqX(fc, c.size.width)} y={(tone.top ?? 0) + 12} label="FILTER" below cursor="ew-resize"
        onPointerDown={c.drag({ x: { offset: BC.filter, px: 200 } })} onReset={c.reset(BC.filter)} />
    </Svg>
  );
}

export const CRUSH_IN_VIEW = [BC.filter, BC.rate, BC.low, BC.high];
