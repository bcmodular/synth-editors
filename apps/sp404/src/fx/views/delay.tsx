// Drawings for the delays, from the designs: echo taps on a beat grid (Sync Delay, Ko-Da-Ma, Zan-Zou,
// TimeCtrlDly, SX Delay) with a damping band, the tape loop with its heads (Tape Echo), and a grain cloud
// (Cloud Delay).

import { bipolar, Caption, clamp, Handle, signed, Svg, type Px } from "./draw";
import { noise } from "./noise";
import { DampBand } from "./parts";
import type { ViewProps } from "./types";
import { useViewContext, type ViewContext } from "./viewContext";

// A note value as a fraction of a bar: "1/8" = 0.125, "1/8T" two thirds of that, "1/8D" half as much again.
export function noteFraction(label: string): number | undefined {
  const m = /^(\d+)\/(\d+)([TD]?)$/.exec(label);
  if (!m) return undefined;
  const v = Number(m[1]) / Number(m[2]);
  return m[3] === "T" ? (v * 2) / 3 : m[3] === "D" ? v * 1.5 : v;
}

// ---- taps

interface TapSpec {
  time: number; // between repeats, in bars
  feedback: number; // parameter index
  level?: number; // parameter index (SX Delay has none)
  pan?: boolean; // alternate left (above) and right (below) the centre line
  pattern?: number[]; // taps within a repeat, as fractions of it (Zan-Zou's 2/3/4 taps)
  base: Px;
}

const TOP = 14;

function BeatGrid({ c, bars, base }: { c: ViewContext; bars: number; base: Px }) {
  const pxPerBar = (c.size.width - 14) / bars;
  const lines = [];
  for (let b = 0; b <= bars * 4; b++) {
    const x = 8 + (b * pxPerBar) / 4;
    if (x > c.size.width) break;
    lines.push(<line key={b} className={b % 4 ? "gr" : "ax"} x1={x} y1={TOP - 6} x2={x} y2={base} />);
  }
  return <g>{lines}<text className="gl" x={c.size.width - 3} y={TOP - 4} textAnchor="end">bars</text></g>;
}

interface Tap {
  x: Px;
  y: Px;
  h: Px;
  amp: number;
  key: string;
}

interface TapGeometry {
  pxPerBar: Px;
  span: Px;
  mid: Px;
  fb: number;
  level: number;
}

function tapGeometry(c: ViewContext, s: TapSpec, bars: number): TapGeometry {
  const span = s.base - TOP;
  return {
    pxPerBar: (c.size.width - 14) / bars, span, mid: TOP + span / 2, fb: c.raw(s.feedback) / 127,
    level: s.level === undefined ? 0.9 : 0.4 + (c.raw(s.level) / 127) * 0.6,
  };
}

// Tap j of repeat `rep`, at fraction `f` of the repeat; the left/right alternation runs across all taps.
function tapAt(s: TapSpec, g: TapGeometry, [rep, j, f]: [number, number, number]): Tap {
  const amp = g.level * Math.pow(g.fb, rep);
  const h = Math.max(1, amp * g.span * (s.pan ? 0.48 : 1));
  const left = (rep * (s.pattern?.length ?? 1) + j) % 2 === 0;
  const y = s.pan ? (left ? g.mid - h : g.mid) : s.base - h;
  return { x: 8 + (rep + f) * s.time * g.pxPerBar, y, h, amp, key: `${rep}.${j}` };
}

function tapList(c: ViewContext, s: TapSpec, bars: number): Tap[] {
  const g = tapGeometry(c, s, bars);
  const pattern = s.pattern ?? [1];
  const all = Array.from({ length: 40 }, (_, rep) => pattern.map((f, j) => tapAt(s, g, [rep, j, f]))).flat();
  return all.filter((t) => t.x <= c.size.width - 4);
}

function Taps({ c, spec }: { c: ViewContext; spec: TapSpec }) {
  const bars = Math.max(1, spec.time * 7);
  const taps = tapList(c, spec, bars);
  const mid = TOP + (spec.base - TOP) / 2;
  const [first, second] = [taps[0], taps.find((t) => t.key.startsWith("1."))];
  return (
    <g>
      <BeatGrid c={c} bars={bars} base={spec.base} />
      {spec.pan && <line className="ax" x1={0} y1={mid} x2={c.size.width} y2={mid} />}
      {taps.map((t) => <rect key={t.key} className="af" x={t.x - 2.5} y={t.y} width={5} height={t.h} opacity={0.35 + 0.65 * t.amp} />)}
      {first && spec.level !== undefined && (
        <Handle size={c.size} x={first.x} y={first.y} label="LEVEL" onPointerDown={c.drag({ y: { index: spec.level } })} />
      )}
      {second && (
        <Handle size={c.size} x={second.x} y={second.y === mid ? mid + second.h : second.y} label="FB"
          onPointerDown={c.drag({ y: { index: spec.feedback } })} />
      )}
    </g>
  );
}

interface DelaySpec {
  time: (c: ViewContext) => number;
  feedback?: number; // parameter index, default 1
  caption: (c: ViewContext) => string;
  level?: number;
  damp?: [number, number];
  pan?: (c: ViewContext) => boolean;
  pattern?: (c: ViewContext) => number[];
}

function DelayView({ spec, ...props }: ViewProps & { spec: DelaySpec }) {
  const c = useViewContext(props);
  const base = c.size.height - (spec.damp ? 22 : 6);
  const taps: TapSpec = {
    time: spec.time(c) || 0.25, feedback: spec.feedback ?? 1, level: spec.level, base, pan: spec.pan?.(c), pattern: spec.pattern?.(c),
  };
  return (
    <Svg size={c.size}>
      <Taps c={c} spec={taps} />
      {spec.damp && <DampBand c={c} y={c.size.height - 17} lo={spec.damp[0]} hi={spec.damp[1]} />}
      <text className="gt" x={6} y={12}>{spec.caption(c)}</text>
    </Svg>
  );
}

const noteTime = (i: number) => (c: ViewContext) => noteFraction(c.text(i)) ?? 0.25;
const msTime = (i: number) => (c: ViewContext) => Number(c.text(i)) / 2000; // drawn at 120 BPM: a bar is 2000 ms
const fbCaption = (c: ViewContext) => `${c.text(0)} · FB ${c.text(1)}%`;

// 3 · Taps on a beat grid; LEVEL on the first, FEEDBACK on the second; the damping band below.
export const SyncDelayView = (props: ViewProps) =>
  <DelayView {...props} spec={{ time: noteTime(0), caption: fbCaption, level: 2, damp: [3, 4] }} />;

// 9 · As Sync Delay; in PAN mode the taps alternate left (above) and right (below).
export const KoDaMaView = (props: ViewProps) =>
  <DelayView {...props} spec={{ time: noteTime(0), caption: fbCaption, level: 2, damp: [3, 4], pan: (c) => c.step(5) === 1 }} />;

const ZAN_ZOU_TAPS = [[0.5, 1], [1 / 3, 2 / 3, 1], [0.25, 0.5, 0.75, 1]];

// 10 · Two, three or four taps per repeat, alternating left and right. (The tap pattern is a guess.)
export const ZanZouView = (props: ViewProps) => (
  <DelayView {...props} spec={{
    time: (c) => (c.synced ? noteTime(0)(c) : 0.06 + (c.raw(0) / 127) * 0.9),
    caption: (c) => `${c.synced ? c.text(0) : `TIME ${c.text(0)}`} · ${c.text(4)}`,
    level: 3, pan: () => true, pattern: (c) => ZAN_ZOU_TAPS[c.step(4)] ?? [1],
  }} />
);

// 15 · As Sync Delay; TIME in ms with SYNC off (the grid drawn at 120 BPM).
export const TimeCtrlDlyView = (props: ViewProps) => (
  <DelayView {...props} spec={{
    time: (c) => (c.synced ? noteTime(0)(c) : msTime(0)(c)), caption: (c) => `${c.text(0)}${c.synced ? "" : " ms"} · FB ${c.text(1)}%`,
    level: 2, damp: [3, 4],
  }} />
);

// 42 · Taps like the other delays (FEEDBACK and LEVEL handles); LOOP is a large button, LENGTH a knob.
export const DjfxDelayView = (props: ViewProps) => (
  <DelayView {...props} spec={{
    time: (c) => (c.synced ? noteTime(1)(c) : msTime(1)(c)), feedback: 3, level: 4,
    caption: (c) => `${c.step(2) ? "LOOP ON · " : ""}${c.text(1)}${c.synced ? "" : " ms"} · LEN ${c.text(0)} s`,
  }} />
);

// 39 · Taps with FEEDBACK on the second; SX Delay has no level parameter.
export const SxDelayView = (props: ViewProps) => <DelayView {...props} spec={{ time: noteTime(0), caption: fbCaption }} />;

// ---- Tape Echo

const HEADS = ["S", "M", "L"] as const;
const HEAD_TAP = { S: 1, M: 2, L: 3 } as const;

// The mode with these heads, as the SP-404 lists them (S, M, L, S+M … S+M+L), or undefined for none.
export function tapeMode(heads: ReadonlySet<string>, labels: readonly string[]): number | undefined {
  const name = HEADS.filter((h) => heads.has(h)).join("+");
  const i = labels.indexOf(name);
  return i >= 0 ? i : undefined;
}

function TapeHeads({ c, loop, top, height }: { c: ViewContext; loop: Px; top: Px; height: Px }) {
  const labels = c.labels(3);
  const heads = new Set((labels[c.step(3)] ?? "S").split("+"));
  const toggle = (head: string) => {
    const next = new Set(heads);
    if (next.has(head)) next.delete(head);
    else next.add(head);
    const i = tapeMode(next, labels);
    if (i !== undefined) c.set(3, c.starts(3)[i] ?? 0);
  };
  return (
    <g>
      {["REC", ...HEADS].map((h, i) => {
        const x = 6 + loop * (0.2 + i * 0.2);
        const on = i === 0 || heads.has(h);
        return (
          <g key={h} className={on ? "on" : ""} role={i ? "button" : undefined} aria-label={i ? `${h} head` : undefined}
            aria-pressed={i ? on : undefined} onClick={i ? () => toggle(h) : undefined}>
            <rect className="pad" x={x - 14} y={top + height - 9} width={28} height={18} rx={2} />
            <text className="padt" x={x} y={top + height + 4} textAnchor="middle">{h}</text>
          </g>
        );
      })}
    </g>
  );
}

// 14 · The tape loop: drag its end for TIME, click the S, M and L heads for MODE; taps below, wow line above them.
export function TapeEchoView(props: ViewProps) {
  const c = useViewContext(props);
  const { width: w, height: h } = c.size;
  const ms = Number(c.text(0));
  const [ty, th] = [8, h * 0.38];
  const loop = w * 0.62 + (w - 26 - w * 0.62) * (c.raw(0) / 127);
  const heads = (c.labels(3)[c.step(3)] ?? "S").split("+") as (keyof typeof HEAD_TAP)[];
  const base = h - 8;
  const top = ty + th + 22;
  const unit = (ms / 2400) * (w - 20);
  const fb = c.raw(1) / 127;
  const taps = Array.from({ length: 12 }, (_, rep) => heads.map((m) => ({ x: 10 + (HEAD_TAP[m] + rep * 3) * unit, a: Math.pow(fb, rep) * (0.4 + (0.6 * c.raw(2)) / 127), key: `${rep}${m}` })))
    .flat().filter((t) => t.x <= w - 4);
  const wow = (x: Px) => top - 6 + Math.sin(x * (0.03 + (c.raw(4) / 127) * 0.25)) * (c.raw(5) / 127) * 5;
  return (
    <Svg size={c.size}>
      <rect x={6} y={ty} width={loop} height={th} rx={th / 2} fill="none" stroke="#5b5e66" strokeWidth={3} />
      <text className="big1" x={6 + loop / 2} y={ty + th / 2 - 2} textAnchor="middle">{ms} ms</text>
      <TapeHeads c={c} loop={loop} top={ty} height={th} />
      <Handle size={c.size} x={6 + loop} y={ty + th / 2} label="TIME" onPointerDown={c.drag({ x: { index: 0, scale: 0.6 } })} />
      {taps.map((t) => <rect key={t.key} className="af" x={t.x - 2} y={base - t.a * (base - top)} width={4} height={t.a * (base - top)} opacity={0.4 + 0.6 * t.a} />)}
      <polyline className="cv2" points={Array.from({ length: Math.floor(w / 2) + 1 }, (_, i) => `${i * 2},${wow(i * 2).toFixed(1)}`).join(" ")} />
      <text className="gl" x={w - 6} y={top - 12} textAnchor="end">click the heads</text>
    </Svg>
  );
}

// ---- Cloud Delay

interface Grain {
  x: Px;
  y: Px;
  w: Px;
  h: Px;
  opacity: number;
}

function grains(c: ViewContext): Grain[] {
  const { width: w, height: h } = c.size;
  const mid = h / 2;
  const pitch = -12 + (c.raw(1) / 127) * 24;
  const win = 0.15 + (c.raw(0) / 127) * 0.85;
  const cloudy = c.raw(4) / 127;
  const fb = Math.abs(bipolar(c.raw(3))) / 100;
  const lofi = c.step(5) === 1;
  const out: Grain[] = [];
  const count = 20 + Math.round(cloudy * 70);
  for (let gen = 0; gen < 3 && (gen === 0 || gen <= fb * 3); gen++) {
    for (let i = 0; i < count; i++) {
      const x = w * 0.06 + gen * w * 0.3 + noise(i + gen * 99) * w * win * 0.5;
      if (x > w) continue;
      const y = mid - ((pitch * (gen + 1)) / 12) * (mid - 14) * (gen ? 0.6 : 1) + (noise(i + 7) - 0.5) * (20 + 90 * cloudy);
      const opacity = 0.25 + 0.6 * (1 - gen / 3) * noise(i + 3);
      out.push(lofi
        ? { x: Math.round(x / 8) * 8, y: Math.round(y / 8) * 8, w: 7, h: 7, opacity: Math.round(opacity * 3) / 3 + 0.1 }
        : { x, y, w: 3 + win * 6, h: 3, opacity });
    }
  }
  return out;
}

// 40 · A grain cloud: WINDOW × PITCH handle; CLOUDY scatters it, feedback generations drift; LOFI makes blocks.
export function CloudDelayView(props: ViewProps) {
  const c = useViewContext(props);
  const { width: w, height: h } = c.size;
  const mid = h / 2;
  const pitch = -12 + (c.raw(1) / 127) * 24;
  const win = 0.15 + (c.raw(0) / 127) * 0.85;
  const y = (semis: number) => mid - (semis / 12) * (mid - 14);
  return (
    <Svg size={c.size}>
      {[-12, -6, 0, 6, 12].map((s) => (
        <g key={s}>
          <line className={s ? "gr" : "ax"} x1={0} y1={y(s)} x2={w} y2={y(s)} />
          <text className="gl" x={3} y={y(s) - 2}>{signed(s)}</text>
        </g>
      ))}
      {grains(c).map((g, i) => <rect key={i} className="af" x={g.x} y={clamp(g.y, 4, h - 4)} width={g.w} height={g.h} opacity={g.opacity} />)}
      <Handle size={c.size} x={w * 0.08 + w * win * 0.6} y={y(pitch)} label="WINDOW · PITCH"
        onPointerDown={c.drag({ x: { index: 0 }, y: { index: 1, scale: 0.6 } })} />
      <Caption size={c.size}>FB {signed(bipolar(c.raw(3)))}{c.step(5) ? " · LOFI" : ""}</Caption>
    </Svg>
  );
}
