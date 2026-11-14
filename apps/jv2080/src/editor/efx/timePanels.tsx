// EFX drawings over time and pitch: delay taps with their repeats, pitch-shifter voices on a semitone ladder, the
// reverb's tail and the gate reverb's shapes. Delay and pre-delay times are raw values (their ms aren't known yet),
// drawn in proportion.

import { dragXY } from "../../ui/dragXY";
import { Handle } from "../../ui/Drawing";
import { curvePoints, Frame, PAD, TOP, type Size } from "./drawKit";
import type { PanelSpec } from "./specs";
import { amount, fraction, type EfxParam, type GetParam } from "./useEfx";

type Spec<K extends PanelSpec["kind"]> = Extract<PanelSpec, { kind: K }>;

interface PanelProps<K extends PanelSpec["kind"]> {
  spec: Spec<K>;
  get: GetParam;
  size: Size;
}

const MAX_REPEATS = 8;

// --- Delay: each tap at its time and level; the longest one repeats by the feedback (inverted below the line) ---

interface TapView {
  label: string;
  time: EfxParam;
  level?: EfxParam;
}

export function DelayPanel({ spec, get, size }: PanelProps<"delay">) {
  const { width, height } = size;
  const taps: TapView[] = spec.taps.map((t) => ({ label: t.label, time: get(t.time), level: t.level ? get(t.level) : undefined }));
  const feedback = spec.feedback ? get(spec.feedback) : undefined;
  const fb = feedback ? amount(feedback) / 100 : 0;
  const mid = (TOP + height - PAD) / 2 + 6;
  const tall = mid - TOP - 4;
  const x0 = PAD + 4;
  const span = (width - x0 - PAD) * 0.45; // the longest delay fits in under half the width, leaving room for repeats
  const tx = (t: EfxParam) => x0 + 6 + fraction(t) * span;
  const levelOf = (t: TapView) => (t.level ? fraction(t.level) : 1);
  const longest = taps.reduce((a, b) => (b.time.raw > a.time.raw ? b : a), taps[0]!);
  const period = tx(longest.time) - x0;
  const repeats = Array.from({ length: MAX_REPEATS }, (_, i) => ({ x: tx(longest.time) + (i + 1) * period, v: fb ** (i + 1) }))
    .filter((r) => r.x < width - PAD && Math.abs(r.v) > 0.02);
  const values = [...taps.map((t) => `${t.label || "TIME"} ${t.time.text}`), feedback && `FB ${feedback.text}`].filter(Boolean).join(" · ");
  return (
    <Frame size={size} title={spec.title} values={values}>
      <line className="axis" x1={0} x2={width} y1={mid} y2={mid} />
      <line className="dry" x1={x0} x2={x0} y1={mid} y2={mid - tall} />
      {repeats.map((r, i) => (
        <line key={i} className="tap dim" x1={r.x} x2={r.x} y1={mid} y2={mid - Math.sign(r.v) * Math.abs(r.v) * levelOf(longest) * tall} />
      ))}
      {taps.map((t) => (
        <g key={t.label || "t"}>
          <line className="tap" x1={tx(t.time)} x2={tx(t.time)} y1={mid} y2={mid - levelOf(t) * tall} />
          {t.label && <text className="gl" x={tx(t.time)} y={height - 3} textAnchor="middle">{t.label}</text>}
          <Handle x={tx(t.time)} y={mid - levelOf(t) * tall}
            onPointerDown={(e) => dragXY(e, { x: t.time.axis(span), y: t.level?.axis(tall) })} />
        </g>
      ))}
      {feedback && repeats[0] && (
        <Handle x={repeats[0].x} y={mid - fb * levelOf(longest) * tall} onPointerDown={(e) => dragXY(e, { y: feedback.axis(tall * 2) })} />
      )}
      {spec.accel && <text className="gl" x={width - 6} y={height - 3} textAnchor="end">ACCEL {get(spec.accel).text}</text>}
    </Frame>
  );
}

// --- Pitch: each voice a line at its interval on a −24…+12 semitone ladder; drag up / down for the coarse pitch ---

const ST_LO = -24;
const ST_HI = 12;

export function PitchPanel({ spec, get, size }: PanelProps<"pitch">) {
  const { width, height } = size;
  const st = (v: number) => TOP + ((ST_HI - v) / (ST_HI - ST_LO)) * (height - TOP - PAD);
  const feedback = spec.feedback ? get(spec.feedback) : undefined;
  const lanes = spec.voices.length;
  const laneW = (width - 2 * PAD - 30) / lanes;
  const values = spec.voices.map((v) => `${v.label} ${get(v.coarse).text}`).join(" · ") + (feedback ? ` · FB ${feedback.text}` : "");
  return (
    <Frame size={size} title={spec.title} values={values}>
      {[-24, -12, 0, 12].map((v) => (
        <g key={v}>
          <line className={v === 0 ? "axis strong" : "axis"} x1={PAD + 26} x2={width - PAD} y1={st(v)} y2={st(v)} />
          <text className="gl" x={PAD + 20} y={st(v) + 4} textAnchor="end">{v > 0 ? `+${v}` : v}</text>
        </g>
      ))}
      {spec.voices.map((v, i) => {
        const coarse = get(v.coarse);
        const fine = get(v.coarse.replace("Coarse", "Fine"));
        const interval = amount(coarse) + amount(fine) / 100;
        const x1 = PAD + 30 + i * laneW + 6;
        const x2 = x1 + laneW - 12;
        const echoes = feedback ? Array.from({ length: 3 }, (_, k) => ({ v: interval * (k + 2), a: Math.abs(amount(feedback) / 100) ** (k + 1) })) : [];
        return (
          <g key={v.coarse}>
            {echoes.filter((e) => e.v >= ST_LO && e.v <= ST_HI && e.a > 0.05).map((e, k) => (
              <line key={k} className="voice dim" x1={x1} x2={x2} y1={st(e.v)} y2={st(e.v)} style={{ opacity: e.a }} />
            ))}
            <line className="voice" x1={x1} x2={x2} y1={st(interval)} y2={st(interval)} />
            {v.label && <text className="gl" x={x1} y={st(interval) - 5}>{v.label}</text>}
            <Handle x={(x1 + x2) / 2} y={st(interval)} onPointerDown={(e) => dragXY(e, { y: coarse.axis(height - TOP - PAD) })} />
          </g>
        );
      })}
    </Frame>
  );
}

// --- Reverb: the tail after the pre-delay; drag the start for the pre-delay, the handle for the time ---

export function ReverbPanel({ spec, get, size }: PanelProps<"reverb">) {
  const { width, height } = size;
  const time = get(spec.time);
  const pre = get(spec.preDelay);
  const base = height - PAD;
  const span = base - TOP;
  const x0 = PAD + 6 + fraction(pre) * width * 0.2;
  const len = 16 + fraction(time) * (width - x0 - PAD);
  const level = (x: number) => (x < x0 ? 0 : Math.exp((-3 * (x - x0)) / len));
  const xt = x0 + len * 0.75;
  return (
    <Frame size={size} title={spec.title} values={`PRE-DELAY ${pre.text} · TIME ${time.text}`}>
      <line className="axis" x1={0} x2={width} y1={base} y2={base} />
      <line className="dry" x1={PAD} x2={PAD} y1={base} y2={TOP + 4} />
      <polygon className="area" points={`${x0},${base} ${curvePoints(width, (x) => base - level(x) * span)} ${width - PAD},${base}`} />
      <Handle x={x0} y={TOP + 2} onPointerDown={(e) => dragXY(e, { x: pre.axis(width * 0.2) })} />
      <Handle x={xt} y={base - Math.exp(-2.25) * span} onPointerDown={(e) => dragXY(e, { x: time.axis(width * 0.8) })} />
    </Frame>
  );
}

// --- Gate reverb: NORMAL decays then stops, REVERSE swells then stops, SWEEP 1 / 2 move between left and right ---

function gateLevel(type: number, t: number): number {
  if (type === 1) return 0.15 + 0.85 * t; // reverse: swells
  return 1 - 0.35 * t; // normal and sweeps: a gentle decay, then the gate shuts
}

export function GatePanel({ spec, get, size }: PanelProps<"gate">) {
  const { width, height } = size;
  const type = get("Type");
  const gate = get(spec.gateTime);
  const pre = get(spec.preDelay);
  const sweep = type.raw >= 2;
  const mid = sweep ? (TOP + height - PAD) / 2 : height - PAD;
  const tall = sweep ? (height - TOP - PAD) / 2 - 2 : height - TOP - PAD;
  const x0 = PAD + 6 + fraction(pre) * width * 0.2;
  const x1 = x0 + 10 + fraction(gate) * (width - x0 - PAD - 10);
  const side = (t: number) => (!sweep ? 1 : (type.raw === 2 ? 1 - 2 * t : 2 * t - 1));
  const y = (x: number) => {
    if (x < x0 || x > x1) return mid;
    const t = (x - x0) / (x1 - x0);
    return mid - gateLevel(type.raw, t) * tall * (sweep ? side(t) : 1);
  };
  return (
    <Frame size={size} title={spec.title} values={`${type.text} · PRE-DELAY ${pre.text} · GATE ${gate.text}`}>
      <line className="axis" x1={0} x2={width} y1={mid} y2={mid} />
      {sweep && (
        <>
          <text className="gl" x={width - 6} y={TOP + 10} textAnchor="end">L</text>
          <text className="gl" x={width - 6} y={height - PAD - 2} textAnchor="end">R</text>
        </>
      )}
      <polygon className="area" points={`${x0},${mid} ${curvePoints(width, y, 1)} ${width - PAD},${mid}`} />
      <Handle x={x0} y={mid} onPointerDown={(e) => dragXY(e, { x: pre.axis(width * 0.2) })} />
      <Handle x={x1} y={y(x1 - 1)} onPointerDown={(e) => dragXY(e, { x: gate.axis(width * 0.8) })} />
    </Frame>
  );
}
