// Drawings for the DJ and performance effects, from the designs: a waveform with the loop window (DJFX Looper),
// TYPE and DEPTH pads (Scatter), the drop over time (Downer), a tape stop (Stopper) and a platter (Back Spin).
// DJFX Delay uses the delays' taps (delay.tsx).

import { bipolar, clamp, Handle, pct, signed, Svg, type Px } from "./draw";
import { noteFraction } from "./delay";
import { noise } from "./noise";
import { Pad } from "./parts";
import type { ViewProps } from "./types";
import { useViewContext, type ViewContext } from "./viewContext";

// ---- DJFX Looper

const waveHeight = (x: Px, height: Px) => (0.25 + 0.75 * noise(x)) * (height * 0.32) * (0.6 + 0.4 * Math.sin(x * 0.05));

function Waveform({ from, to, height, lit }: { from: Px; to: Px; height: Px; lit?: boolean }) {
  const mid = height / 2 - 6;
  const lines = [];
  for (let x = from; x < to; x += 3) {
    const a = waveHeight(x, height);
    lines.push(<line key={x} className={lit ? "cv" : "gr"} style={lit ? { strokeWidth: 1 } : undefined} x1={x} y1={mid - a} x2={x} y2={mid + a} />);
  }
  return <g>{lines}</g>;
}

// 5 · The loop window over a waveform: drag its edge for LENGTH, the bottom strip for SPEED; LOOP is a big button.
export function DjfxLooperView(props: ViewProps) {
  const c = useViewContext(props);
  const { width: w, height: h } = c.size;
  const seconds = Number(c.text(0));
  const win = 12 + (seconds / 0.23) * (w * 0.55);
  const x0 = w * 0.3;
  const looping = c.step(2) === 1;
  const speed = bipolar(c.raw(1));
  return (
    <Svg size={c.size}>
      <Waveform from={2} to={w} height={h} />
      <rect className="ar" x={x0} y={10} width={win} height={h - 40} style={{ fillOpacity: looping ? 0.45 : 0.18 }} />
      <line className="cv" x1={x0} y1={10} x2={x0} y2={h - 30} />
      <line className="cv" x1={x0 + win} y1={10} x2={x0 + win} y2={h - 30} />
      <Waveform from={x0} to={x0 + win} height={h} lit />
      <rect className="dragx" x={x0 + win - 6} y={10} width={12} height={h - 40} fill="#fff" fillOpacity={0.12}
        onPointerDown={c.drag({ x: { index: 0, scale: -0.7 } })} role="slider" aria-label="LENGTH" />
      <text className="gt" x={x0 + win / 2} y={h - 14} textAnchor="middle">{speed < 0 ? "◀ " : ""}SPEED {signed(speed)}{speed >= 0 ? " ▶" : ""}</text>
      <rect className="dragx" x={0} y={h - 28} width={w} height={24} fill="transparent" onPointerDown={c.drag({ x: { index: 1, scale: 0.6 } })}
        role="slider" aria-label="SPEED" />
      <text className="big1" x={6} y={22}>{c.text(0)} s</text>
      <text className="gl" x={x0 + win + 4} y={22}>drag edge</text>
    </Svg>
  );
}

// ---- Scatter

function TypePads({ c, top }: { c: ViewContext; top: Px }) {
  const pw = (c.size.width - 2) / 10;
  return (
    <g>
      {c.labels(0).map((label, i) => (
        <Pad key={label} box={{ x: 2 + i * pw, y: top, w: pw - 2, h: 22 }} on={c.step(0) === i} label={label} fontSize={12}
          onPick={() => c.set(0, c.starts(0)[i] ?? 0)} />
      ))}
    </g>
  );
}

// DEPTH as ten rising bars, lit up to the chosen depth.
function DepthBars({ c, top }: { c: ViewContext; top: Px }) {
  const bh = c.size.height - top - 2;
  const dw = (c.size.width - 2) / 10;
  const depth = c.step(1);
  return (
    <g>
      {c.labels(1).map((label, i) => {
        const h = bh * (0.3 + (0.7 * (i + 1)) / 10);
        const x = 2 + i * dw;
        const on = i <= depth;
        return (
          <g key={label} className={on ? "on" : ""} role="button" aria-label={`DEPTH ${label}`} aria-pressed={i === depth}
            onClick={() => c.set(1, c.starts(1)[i] ?? 0)}>
            <rect className="pad" x={x} y={top + bh - h} width={dw - 2} height={h} rx={3} style={on && i < depth ? { fillOpacity: 0.55 } : undefined} />
            <text className="padt" x={x + (dw - 2) / 2} y={top + bh - 6} textAnchor="middle">{label}</text>
          </g>
        );
      })}
    </g>
  );
}

// 6 · TYPE as a compact row of ten pads; DEPTH as ten large rising bars; SCATTER is a big button.
export function ScatterView(props: ViewProps) {
  const c = useViewContext(props);
  const y0 = 16 + 22 + 12;
  return (
    <Svg size={c.size}>
      <text className="gt" x={4} y={11}>TYPE {c.text(0)}</text>
      <TypePads c={c} top={16} />
      <text className="gt" x={4} y={y0 + 8}>DEPTH {c.text(1)}</text>
      <DepthBars c={c} top={y0 + 14} />
    </Svg>
  );
}

// ---- Downer and Stopper: a curve over the RATE note value

interface Sweep {
  top: Px;
  bottom: Px;
  end: Px; // where the curve reaches its depth
  bars: number; // drawn across the width
}

function sweep(c: ViewContext, rateIndex: number, stretch: number): Sweep {
  const len = noteFraction(c.text(rateIndex)) ?? 1;
  const bars = Math.max(1, len) * stretch;
  return { top: 20, bottom: c.size.height - 14, end: 8 + (len / bars) * (c.size.width - 16), bars };
}

function SweepGrid({ c, s }: { c: ViewContext; s: Sweep }) {
  const lines = [];
  for (let b = 0; b <= s.bars * 4; b++) {
    const x = 8 + (b / (s.bars * 4)) * (c.size.width - 16);
    lines.push(<line key={b} className={b % 4 ? "gr" : "ax"} x1={x} y1={s.top} x2={x} y2={s.bottom} />);
  }
  return <g>{lines}</g>;
}

// A curve over the sweep: y(t) for t = 0…1 across it (and held after it ends).
function curvePoints(c: ViewContext, s: Sweep, y: (t: number) => Px): string {
  const pts: string[] = [];
  for (let x = 8; x <= c.size.width - 8; x += 2) pts.push(`${x},${y(clamp((x - 8) / (s.end - 8), 0, 1)).toFixed(1)}`);
  return pts.join(" ");
}

// 7 · The drop over time: solid = pitch (dimmed with PITCH off), dashed = filter; drag the end for DEPTH.
export function DownerView(props: ViewProps) {
  const c = useViewContext(props);
  const s = sweep(c, 1, 1);
  const span = s.bottom - s.top;
  const depth = c.raw(0) / 127;
  const pitchOn = c.step(3) === 1;
  const fall = (t: number) => 1 - (1 - Math.pow(t, 0.7));
  return (
    <Svg size={c.size}>
      <SweepGrid c={c} s={s} />
      <polyline className="cv" style={pitchOn ? undefined : { strokeOpacity: 0.25 }} points={curvePoints(c, s, (t) => s.top + fall(t) * depth * span)} />
      <polyline className="cv2" points={curvePoints(c, s, (t) => s.top + fall(t) * (c.raw(2) / 127) * span + 6)} />
      <Handle size={c.size} x={s.end} y={s.top + depth * span} label="DEPTH" onPointerDown={c.drag({ y: { index: 0 } })} />
      <text className="gt" x={6} y={12}>PITCH {pitchOn ? "ON" : "OFF"} · {c.text(1)}</text>
      <text className="gl" x={c.size.width - 6} y={12} textAnchor="end">— pitch  - - filter</text>
    </Svg>
  );
}

// 13 · A tape stop: speed slows over the RATE note value by DEPTH (drag the end); dashed = level (AMP MOD).
export function StopperView(props: ViewProps) {
  const c = useViewContext(props);
  const s = sweep(c, 1, 1.25);
  const span = s.bottom - s.top;
  const depth = c.raw(0) / 127;
  return (
    <Svg size={c.size}>
      <SweepGrid c={c} s={s} />
      <polyline className="cv" points={curvePoints(c, s, (t) => s.bottom - (1 - depth * t * t) * span)} />
      <polyline className="cv2" points={curvePoints(c, s, (t) => s.bottom - (1 - (c.raw(4) / 127) * t) * span + 4)} />
      <Handle size={c.size} x={s.end} y={s.bottom - (1 - depth) * span} label="DEPTH" onPointerDown={c.drag({ y: { index: 0 } })} />
      <text className="gt" x={6} y={12}>TAPE STOP · {c.text(1)}</text>
      <text className="gl" x={c.size.width - 6} y={12} textAnchor="end">— speed  - - level</text>
    </Svg>
  );
}

// ---- Back Spin

// An arc on a circle from the top, anticlockwise through `turns` of a turn.
function arcPath(cx: Px, cy: Px, r: Px, turns: number): { d: string; end: { x: Px; y: Px } } {
  const a1 = -Math.PI / 2;
  const a2 = a1 - turns * 2 * Math.PI * 0.98;
  const end = { x: cx + r * Math.cos(a2), y: cy + r * Math.sin(a2) };
  return { d: `M ${cx + r * Math.cos(a1)} ${cy + r * Math.sin(a1)} A ${r} ${r} 0 ${turns > 0.5 ? 1 : 0} 0 ${end.x} ${end.y}`, end };
}

// 41 · A platter: the arc is LENGTH, lit while BACK is held; drag up and down on it for SPEED.
export function BackSpinView(props: ViewProps) {
  const c = useViewContext(props);
  const [cx, cy] = [c.size.width / 2, c.size.height / 2];
  const r = Math.min(c.size.height / 2 - 10, c.size.width / 2 - 10);
  const back = c.step(2) === 1;
  const arc = arcPath(cx, cy, r - 8, noteFraction(c.text(0)) ?? 1);
  return (
    <Svg size={c.size}>
      <circle cx={cx} cy={cy} r={r} fill="#141518" stroke="#3a3b41" strokeWidth={2} />
      {[1, 2, 3, 4, 5].map((k) => <circle key={k} cx={cx} cy={cy} r={(r * k) / 6} fill="none" stroke="#202227" />)}
      <path d={arc.d} fill="none" stroke="var(--acc)" strokeWidth={7} strokeOpacity={back ? 1 : 0.4} />
      <polygon className="af" points={`${arc.end.x - 8},${arc.end.y} ${arc.end.x + 8},${arc.end.y - 4} ${arc.end.x + 4},${arc.end.y + 8}`} />
      <text className="gt" x={cx} y={cy + 5} textAnchor="middle">{c.text(0)} · SPEED {pct(c.raw(1))}</text>
      <rect className="drag" x={cx - r} y={cy - r} width={2 * r} height={2 * r} fill="transparent" onPointerDown={c.drag({ y: { index: 1 } })} />
    </Svg>
  );
}
