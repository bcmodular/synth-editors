// Drawings for the time and pitch effects (after the SP-404's delay, pitch and reverb views): delay repeats on a
// bar, the reverb's tail on a square-root time axis, and the pitch shifter's two voices.
import { bpmBars, delayTaps, tailLevel } from "../../core/efxShapes";
import { Caption, Handle, sample, Svg, Well } from "../../ui/draw";
import type { Px, Region } from "../../ui/draw";
import { OverBand } from "./parts";
import { useEfxView } from "./viewContext";
import type { AxisSpec, EfxView, EfxViewProps } from "./viewContext";

// ---- delay

export const DELAY = { mode: 0x3f, time: 0x40, tap: 0x41, sync: 0x42, feedback: 0x43, lpf: 0x44, efx: 0x45 } as const;
const D = DELAY;
const DELAY_TIME_BARS = 0.5; // TIME at its maximum, drawn as half a bar

type TapAt = ReturnType<typeof delayTaps>[number];

interface TapHandle {
  tap: TapAt | undefined;
  label: string;
  offset: number;
  axis: "x" | "y";
  spec: AxisSpec;
}

// PAN: TAP on the left tap, TIME and FEEDBACK on the first two right ones; else TIME and FEEDBACK on the first two.
function tapHandles(c: EfxView, taps: TapAt[]): TapHandle[] {
  const synced = bpmBars({ sync: c.raw(D.sync) }) !== undefined;
  const time: AxisSpec = synced ? { offset: D.sync, px: -160, min: 1 } : { offset: D.time, px: 200 };
  const [tap, timeAt, fbAt] = c.raw(D.mode) === 1 ? [taps[0], taps[1], taps[3]] : [undefined, taps[0], taps[1]];
  return [
    { tap, label: "TAP", offset: D.tap, axis: "x", spec: { offset: D.tap, px: 120 } },
    { tap: timeAt, label: "TIME", offset: D.time, axis: "x", spec: time },
    { tap: fbAt, label: "FEEDBACK", offset: D.feedback, axis: "y", spec: { offset: D.feedback, px: 100 } },
  ];
}

// The repeats as bars from the line (SINGLE: up from the bottom; PAN and STEREO: left above the middle, right below).
function Taps({ c, region }: { c: EfxView; region: Region }) {
  const { width: w, height: h, top = 0 } = region;
  const synced = bpmBars({ sync: c.raw(D.sync) });
  const time = synced ?? (c.raw(D.time) / 100) * DELAY_TIME_BARS;
  const bars = Math.max(1, time * 2);
  const mode = c.raw(D.mode);
  const taps = delayTaps({ time: time / bars, feedback: c.raw(D.feedback), mode, tap: c.raw(D.tap) / 100 });
  const base = mode === 0 ? top + h - 2 : top + h / 2;
  const reach = (mode === 0 ? h - 18 : h / 2 - 10) * (0.3 + (0.7 * c.raw(D.efx)) / 100);
  const tip = (t: TapAt) => base - (t.side === 1 ? -1 : 1) * t.level * reach;
  const beats = Array.from({ length: Math.round(bars * 4) - 1 }, (_, i) => (i + 1) / (bars * 4));
  return (
    <g>
      <Well region={region} />
      {beats.map((f) => (
        <line key={f} className="grid" x1={f * w} y1={top} x2={f * w} y2={top + h} />
      ))}
      <line className="axis" x1={0} y1={base} x2={w} y2={base} />
      {taps.map((t, i) => (
        <line key={i} className="tap" x1={t.at * w} y1={base} x2={t.at * w} y2={tip(t)} />
      ))}
      <Caption region={region}>{synced ? `${c.text(D.sync)} BAR` : c.text(D.time)}</Caption>
      <Caption region={region} right>
        {bars > 1 ? `${bars} BARS` : "1 BAR"}
      </Caption>
      {tapHandles(c, taps).map(
        (t) =>
          t.tap && (
            <Handle key={t.label} size={c.size} x={t.tap.at * w} y={tip(t.tap)} label={t.label} below={t.tap.side === 1}
              cursor={t.axis === "x" ? "ew-resize" : "ns-resize"} onPointerDown={c.drag({ [t.axis]: t.spec })}
              onReset={c.reset(t.offset)} />
          ),
      )}
    </g>
  );
}

// Repeats on a bar (TIME on the first, FEEDBACK on the second; TAP on PAN's left tap), the LPF band below.
export const DelayView = (props: EfxViewProps) => (
  <OverBand props={props} label="DELAY" Main={Taps} hi={D.lpf} title="LPF" />
);

export const delayInView = (raw: (o: number) => number) =>
  raw(D.mode) === 1 ? [D.time, D.feedback, D.lpf, D.tap] : [D.time, D.feedback, D.lpf];

// ---- reverb

export const REVERB = {
  mode: 0x48, time: 0x49, pre: 0x4a, hpf: 0x4b, lpf: 0x4c, density: 0x4d, efx: 0x4e, dry: 0x4f,
} as const;
const R = REVERB;
// The time axis: 0–10 s on a square-root scale, so short pre-delays still show.
const REVERB_MAX_S = 10;
const timeX = (s: number) => Math.sqrt(Math.min(Math.max(s, 0), REVERB_MAX_S) / REVERB_MAX_S);
const xTime = (x: number) => Math.min(Math.max(x, 0), 1) ** 2 * REVERB_MAX_S;

const REVERB_MODES = ["AMBIENT", "ROOM", "HALL 1", "HALL 2", "PLATE", "SPRING", "MOD"];

function Tail({ c, region }: { c: EfxView; region: Region }) {
  const { width: w, height: h, top = 0 } = region;
  const time = c.raw(R.time) / 10;
  const pre = c.raw(R.pre) / 1000;
  const x = (s: number): Px => timeX(s) * w;
  const bottom = top + h - 1;
  const reach = (h - 18) * (0.3 + (0.7 * c.raw(R.efx)) / 100);
  const spring = c.raw(R.mode) === 5;
  const y = (px: Px) => {
    const s = xTime(px / w) - pre;
    const ripple = spring ? 1 + 0.25 * Math.sin(s * 90) : 1;
    return bottom - tailLevel({ time }, s) * reach * ripple;
  };
  const points = sample(w, y, 1);
  const early = Array.from({ length: c.raw(R.density) + 2 }, (_, i) => pre + ((i + 1) * 0.06) / (c.raw(R.density) + 2));
  return (
    <g>
      <Well region={region} />
      {[0.1, 1, 5].map((s) => (
        <g key={s}>
          <line className="grid" x1={x(s)} y1={top} x2={x(s)} y2={top + h} />
          <text className="glabel" x={x(s) + 3} y={bottom - 3}>{`${s} s`}</text>
        </g>
      ))}
      <line className="tap" x1={1} y1={bottom} x2={1} y2={bottom - (h - 18) * (c.raw(R.dry) / 100)} />
      {early.map((s) => (
        <line key={s} className="early" x1={x(s)} y1={bottom} x2={x(s)} y2={bottom - reach * 0.8} />
      ))}
      <polygon className="area" points={`0,${bottom} ${points} ${w},${bottom}`} />
      <polyline className="trace" points={points} />
      <Caption region={region}>{REVERB_MODES[c.raw(R.mode)]}</Caption>
      <Caption region={region} right>
        {c.text(R.time)}
      </Caption>
      <Handle size={c.size} x={x(pre)} y={bottom - reach} label="PRE DLY" below cursor="ew-resize"
        onPointerDown={c.drag({ x: { offset: R.pre, px: 120 } })} onReset={c.reset(R.pre)} />
      <Handle size={c.size} x={x(pre + time)} y={bottom - 4} label="TIME" cursor="ew-resize"
        onPointerDown={c.drag({ x: { offset: R.time, px: 200 } })} onReset={c.reset(R.time)} />
    </g>
  );
}

// The tail (PRE DLY where it starts, TIME where it has died away 60 dB), early reflections thick with DENSITY,
// and the HPF / LPF band below.
export const ReverbView = (props: EfxViewProps) => (
  <OverBand props={props} label="REVERB" Main={Tail} lo={R.hpf} hi={R.lpf} />
);

export const REVERB_IN_VIEW = [R.time, R.pre, R.hpf, R.lpf];

// ---- pitch shift

export const PITCH = { mode: 0x48, p1: 0x49, pre1: 0x4a, fb: 0x4b, lvl1: 0x4c, p2: 0x4d, pre2: 0x4e, lvl2: 0x50 } as const;
const P = PITCH;
const ST = 24; // ± semitones

function Voice(p: { c: EfxView; region: Region; n: 1 | 2 }) {
  const { c, region, n } = p;
  const [pitch, pre, lvl] = n === 1 ? [P.p1, P.pre1, P.lvl1] : [P.p2, P.pre2, P.lvl2];
  const { width: w, height: h, top = 0 } = region;
  const x = 12 + (c.raw(pre) / 100) * (w - 24);
  const y = top + h / 2 - ((c.raw(pitch) - ST) / ST) * (h / 2 - 10);
  const fb = c.raw(P.fb) / 100;
  const echoes = n === 1 ? [1, 2, 3].filter((k) => fb ** k > 0.1) : [];
  return (
    <g>
      <circle className="voice" cx={x} cy={y} r={4 + (c.raw(lvl) / 100) * 10} />
      {echoes.map((k) => (
        <circle key={k} className="voice echo" cx={x + k * 18} cy={y} r={3 + fb ** k * 4} />
      ))}
      <Handle size={c.size} x={x} y={y} label={`${n}: ${c.text(pitch)}`}
        onPointerDown={c.drag({ x: { offset: pre, px: 200 }, y: { offset: pitch, px: 140 } })}
        onReset={c.reset(pitch, pre)} />
    </g>
  );
}

// Each voice on a pitch ladder (±24 semitones) against its pre-delay; the dot's halo is its level, FEEDBACK echoes
// voice 1. 1MONO has one voice.
export function PitchShiftView(props: EfxViewProps) {
  const c = useEfxView(props);
  const region: Region = { ...c.size, top: 0 };
  const { width: w, height: h } = c.size;
  const y = (st: number) => h / 2 - (st / ST) * (h / 2 - 10);
  return (
    <Svg size={c.size} label="PITCH SHIFT">
      <Well region={region} />
      {[-24, -12, 12, 24].map((st) => (
        <g key={st}>
          <line className="grid" x1={0} y1={y(st)} x2={w} y2={y(st)} />
          <text className="glabel" x={w - 3} y={y(st) - 3} textAnchor="end">{`${st > 0 ? "+" : ""}${st}`}</text>
        </g>
      ))}
      <line className="axis" x1={0} y1={y(0)} x2={w} y2={y(0)} />
      <text className="glabel" x={3} y={h - 4}>0 ms</text>
      <text className="glabel" x={w - 3} y={h - 4} textAnchor="end">PRE DLY 100 ms</text>
      <Voice c={c} region={region} n={1} />
      {c.raw(P.mode) !== 0 && <Voice c={c} region={region} n={2} />}
    </Svg>
  );
}

export const pitchInView = (raw: (o: number) => number) =>
  raw(P.mode) === 0 ? [P.p1, P.pre1] : [P.p1, P.pre1, P.p2, P.pre2];
