// Draggable ADSR graph. Attack handle → A (x); decay/sustain handle → D (x) and S (y);
// release handle → R (x). Each stage gets a quarter of the width at full value. A row of small
// faders under the graph edits the same four values.
import { useRef } from "react";
import type { ReactNode } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { HFader } from "./Fader";
import { getZoom } from "./zoom";

export type Stage = "a" | "d" | "s" | "r";
const STAGES: Stage[] = ["a", "d", "s", "r"];
const MAX = 127;
const FINE = 0.15;
const PAD = 10;
const ENV_GAP = 8; // between the A/D/S/R faders

export interface EnvelopeProps {
  a: number;
  d: number;
  s: number;
  r: number;
  onChange: (stage: Stage, raw: number) => void;
  width?: number;
  height?: number;
  disabled?: boolean;
  readOnly?: boolean; // shape shown, handles inert (e.g. while assigning)
  label?: string;
  wrapValue?: (stage: Stage, node: ReactNode) => ReactNode; // e.g. assign targets
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

  const startDrag = (stage: "a" | "d" | "r") => (e: ReactPointerEvent<SVGCircleElement>) => {
    if (props.current.disabled || props.current.readOnly || e.button !== 0) return;
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
      const k = (ev.shiftKey ? FINE : 1) / getZoom();
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
    <g className="handle">
      <circle className="dot" cx={x} cy={y} r={4} />
      <circle
        className="hit"
        cx={x}
        cy={y}
        r={9}
        onPointerDown={startDrag(stage)}
        onDoubleClick={() => !p.disabled && !p.readOnly && p.onChange(stage, 0)}
      />
    </g>
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
        {STAGES.map((k) => {
          const node = (
            <span className="hrow">
              <span className="lbl">{k.toUpperCase()}</span>
              <HFader
                width={(W - 3 * ENV_GAP) / 4 - 14}
                value={p[k]}
                max={MAX}
                disabled={p.disabled}
                onChange={(v) => p.onChange(k, v)}
              />
            </span>
          );
          return <span key={k}>{p.wrapValue ? p.wrapValue(k, node) : node}</span>;
        })}
      </div>
    </div>
  );
}
