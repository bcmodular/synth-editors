// EFX drawings for modulation: an LFO sweep (chorus, flanger, phaser, wah, tremolo, Space-D), stepped for the step
// flanger, with a second voice dashed when the type has a stereo phase; and the rotary's two speakers.
// Rates are raw values (their Hz isn't known yet), so the drawings show speed, not a time scale.

import { dragXY } from "../../ui/dragXY";
import { Handle } from "../../ui/Drawing";
import { curvePoints, Frame, PAD, TOP, type Size } from "./drawKit";
import type { PanelSpec } from "./specs";
import { amount, fraction, type GetParam } from "./useEfx";

type Spec<K extends PanelSpec["kind"]> = Extract<PanelSpec, { kind: K }>;

interface PanelProps<K extends PanelSpec["kind"]> {
  spec: Spec<K>;
  get: GetParam;
  size: Size;
}

const FB_W = 14; // the feedback bar at the right

interface Sweep {
  cycles: number;
  depth: number; // 0–1
  centre: number; // 0–1, the manual position
  steps?: number; // per cycle, for a stepped sweep
  phase: number; // radians
}

function sweepY(s: Sweep, t: number, top: number, span: number): number {
  let a = t * s.cycles * 2 * Math.PI + s.phase;
  if (s.steps) a = Math.floor(a / ((2 * Math.PI) / s.steps)) * ((2 * Math.PI) / s.steps);
  const v = s.centre + Math.sin(a) * s.depth * Math.min(s.centre, 1 - s.centre, 0.5) * 2;
  return top + (1 - v) * span;
}

// The feedback as a bipolar bar at the right edge, dragged up / down.
function FeedbackBar({ get, name, size }: { get: GetParam; name: string; size: Size }) {
  const fb = get(name);
  const mid = (TOP + size.height - PAD) / 2;
  const half = (size.height - TOP - PAD) / 2;
  const y = mid - (amount(fb) / 100) * half;
  const x = size.width - PAD - FB_W / 2;
  return (
    <g>
      <line className="axis" x1={x} x2={x} y1={TOP} y2={size.height - PAD} />
      <rect className="bar" x={x - 4} width={8} y={Math.min(y, mid)} height={Math.abs(mid - y)} />
      <Handle x={x} y={y} onPointerDown={(e) => dragXY(e, { y: fb.axis(half * 2) })} />
    </g>
  );
}

export function LfoPanel({ spec, get, size }: PanelProps<"lfo">) {
  const rate = get(spec.rate);
  const depth = get(spec.depth);
  const manual = spec.manual ? get(spec.manual) : undefined;
  const phase = spec.phase ? get(spec.phase) : undefined;
  const step = spec.step ? get(spec.step) : undefined;
  const drawW = size.width - (spec.feedback ? FB_W + 4 : 0);
  const span = size.height - TOP - PAD;
  const sweep: Sweep = {
    cycles: 0.5 + fraction(rate) * 7.5,
    depth: fraction(depth),
    centre: manual ? 0.1 + fraction(manual) * 0.8 : 0.5,
    steps: step ? 2 + Math.round(fraction(step) * 14) : undefined,
    phase: 0,
  };
  const t = (x: number) => (x - PAD) / (drawW - 2 * PAD);
  const voice = (ph: number) => curvePoints(drawW, (x) => sweepY({ ...sweep, phase: ph }, t(x), TOP, span), sweep.steps ? 1 : 2);
  const values = [`RATE ${rate.text}`, `DEPTH ${depth.text}`, manual && `MANUAL ${manual.text}`, phase && `PHASE ${phase.text}`]
    .filter(Boolean).join(" · ");
  const centreY = TOP + (1 - sweep.centre) * span;
  return (
    <Frame size={size} title={spec.title} values={values}>
      {manual && <line className="axis" x1={0} x2={drawW} y1={centreY} y2={centreY} />}
      {phase && <polyline className="cv2" points={voice((amount(phase) * Math.PI) / 180)} />}
      <polyline className="cv" points={voice(0)} />
      <rect className="drag" x={0} y={TOP} width={drawW} height={span}
        onPointerDown={(e) => dragXY(e, { x: rate.axis(drawW), y: depth.axis(span) })} />
      {manual && <Handle x={PAD + 6} y={centreY} onPointerDown={(e) => dragXY(e, { y: manual.axis(span * 0.8) })} />}
      {spec.feedback && <FeedbackBar get={get} name={spec.feedback} size={size} />}
    </Frame>
  );
}

// --- Rotary: the horn (high) and drum (low), each turning at its slow or fast rate; SLOW / FAST to switch ---

function Speaker({ cx, cy, r, turn, label }: { cx: number; cy: number; r: number; turn: number; label: string }) {
  const sweep = Math.max(0.15, turn) * Math.PI * 1.6;
  const end = { x: cx + r * Math.cos(-Math.PI / 2 + sweep), y: cy + r * Math.sin(-Math.PI / 2 + sweep) };
  return (
    <g>
      <circle className="spk" cx={cx} cy={cy} r={r} />
      <path className="cv" d={`M ${cx} ${cy - r} A ${r} ${r} 0 ${sweep > Math.PI ? 1 : 0} 1 ${end.x} ${end.y}`} />
      <circle className="tip" cx={end.x} cy={end.y} r={3} />
      <text className="gl" x={cx} y={cy + 4} textAnchor="middle">{label}</text>
    </g>
  );
}

export function RotaryPanel({ spec, get, size }: PanelProps<"rotary">) {
  const speed = get(spec.speed);
  const fast = speed.raw === 1;
  const [hiName, loName] = fast ? spec.fast : spec.slow;
  const hi = get(hiName);
  const lo = get(loName);
  const r = Math.min(size.height - TOP - PAD, size.width / 4) / 2 - 4;
  const cy = (TOP + size.height - PAD) / 2;
  const button = (label: string, value: number, x: number) => (
    <g className={`svg-btn ${speed.raw === value ? "on" : ""}`} onClick={() => speed.set(value)}>
      <rect x={x} y={cy - 12} width={52} height={24} rx={2} />
      <text x={x + 26} y={cy + 5} textAnchor="middle">{label}</text>
    </g>
  );
  return (
    <Frame size={size} title={spec.title} values={`${fast ? "FAST" : "SLOW"} · HIGH ${hi.text} · LOW ${lo.text}`}>
      <Speaker cx={PAD + r + 6} cy={cy} r={r * 0.7} turn={fraction(hi)} label="HIGH" />
      <Speaker cx={PAD + 3 * r + 20} cy={cy} r={r} turn={fraction(lo)} label="LOW" />
      <rect className="drag" x={PAD} y={TOP} width={r * 1.6 + 6} height={size.height - TOP - PAD}
        onPointerDown={(e) => dragXY(e, { y: hi.axis(size.height) })} />
      <rect className="drag" x={PAD + 2 * r + 20} y={TOP} width={r * 2} height={size.height - TOP - PAD}
        onPointerDown={(e) => dragXY(e, { y: lo.axis(size.height) })} />
      {button("SLOW", 0, size.width - 2 * 58)}
      {button("FAST", 1, size.width - 58 - PAD + 2)}
    </Frame>
  );
}
