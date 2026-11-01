// Draggable ADSR graph. Attack handle → A (x); decay/sustain handle → D (x) and S (y);
// release handle → R (x). Each stage gets a quarter of the width at full value.
import { useEffect, useRef } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";

export type Stage = "a" | "d" | "s" | "r";
const STAGES: Stage[] = ["a", "d", "s", "r"];
const MAX = 127;
const FINE = 0.15;
const PAD = 10;

export interface EnvelopeProps {
  a: number;
  d: number;
  s: number;
  r: number;
  onChange: (stage: Stage, raw: number) => void;
  width?: number;
  height?: number;
  disabled?: boolean;
  label?: string;
}

const clamp = (v: number) => Math.max(0, Math.min(MAX, Math.round(v)));

export function EnvelopeEditor(p: EnvelopeProps) {
  const W = p.width ?? 310;
  const H = p.height ?? 110;
  const seg = (W - 2 * PAD) / 4;
  const top = PAD;
  const floor = H - PAD;
  const ax = PAD + (p.a / MAX) * seg;
  const dx = ax + (p.d / MAX) * seg;
  const sy = floor - ((floor - top) * p.s) / MAX;
  const sx = dx + seg * 0.6;
  const rx = sx + (p.r / MAX) * seg;
  const props = useRef(p);
  props.current = p;

  const startDrag = (stage: "a" | "d" | "r") => (e: ReactPointerEvent<SVGRectElement>) => {
    if (props.current.disabled || e.button !== 0) return;
    const el = e.currentTarget;
    el.setPointerCapture(e.pointerId);
    const x0 = e.clientX;
    const y0 = e.clientY;
    const start = { ...props.current };
    let fx = start[stage];
    let fy = start.s;
    let lastX = x0;
    let lastY = y0;
    const move = (ev: PointerEvent) => {
      const k = ev.shiftKey ? FINE : 1;
      fx = Math.max(0, Math.min(MAX, fx + ((ev.clientX - lastX) / seg) * MAX * k));
      fy = Math.max(0, Math.min(MAX, fy - ((ev.clientY - lastY) / (floor - top)) * MAX * k));
      lastX = ev.clientX;
      lastY = ev.clientY;
      const cur = props.current;
      if (clamp(fx) !== cur[stage]) cur.onChange(stage, clamp(fx));
      if (stage === "d" && clamp(fy) !== cur.s) cur.onChange("s", clamp(fy));
    };
    const up = () => {
      el.removeEventListener("pointermove", move as EventListener);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
    };
    el.addEventListener("pointermove", move as EventListener);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
  };

  const handle = (stage: "a" | "d" | "r", x: number, y: number) => (
    <rect
      className="handle"
      x={x - 6}
      y={y - 6}
      width={12}
      height={12}
      onPointerDown={startDrag(stage)}
      onDoubleClick={() => !p.disabled && p.onChange(stage, 0)}
    />
  );

  return (
    <div className={`env ${p.disabled ? "disabled" : ""}`}>
      <svg width={W} height={H}>
        <rect className="well" width={W} height={H} />
        <line className="axis" x1={0} x2={W} y1={floor} y2={floor} />
        {p.label && (
          <text className="glabel" x={W - 6} y={16} textAnchor="end">
            {p.label}
          </text>
        )}
        {!p.disabled && (
          <>
            <path className="shape" d={`M${PAD} ${floor} L${ax} ${top} L${dx} ${sy} L${sx} ${sy} L${rx} ${floor}`} />
            {handle("a", ax, top)}
            {handle("d", dx, sy)}
            {handle("r", rx, floor)}
          </>
        )}
      </svg>
      <div className="envvals" style={{ width: W }}>
        {STAGES.map((k) => (
          <StageValue key={k} stage={k} value={p[k]} disabled={p.disabled} onChange={(v) => p.onChange(k, v)} />
        ))}
      </div>
    </div>
  );
}

function StageValue(p: { stage: Stage; value: number; disabled?: boolean; onChange: (v: number) => void }) {
  const ref = useRef<HTMLSpanElement>(null);
  const props = useRef(p);
  props.current = p;
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let acc = 0;
    const onWheel = (e: WheelEvent) => {
      const { disabled, value, onChange } = props.current;
      if (disabled) return;
      e.preventDefault();
      acc += Math.abs(e.deltaY) >= 40 ? Math.sign(e.deltaY) * 8 : e.deltaY;
      const steps = Math.trunc(acc / 8);
      if (!steps) return;
      acc -= steps * 8;
      const next = clamp(value - steps);
      if (next === value) return;
      props.current = { ...props.current, value: next };
      onChange(next);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);
  return (
    <span ref={ref} className="lbl stagev" onDoubleClick={() => !p.disabled && p.onChange(0)}>
      {p.stage.toUpperCase()} <span className="v">{p.disabled ? "–" : p.value}</span>
    </span>
  );
}
