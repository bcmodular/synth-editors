// Draggable ADSR graph. Attack handle → A (x); decay/sustain handle → D (x) and S (y);
// release handle → R (x). Each stage gets a quarter of the width at full value. The four values sit inside the
// graph, each under its stage: drag one up or down, scroll it, or double-click it to zero.
import { useRef } from "react";
import type { ReactNode } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { spreadTags } from "./envTags";
import { useValueDrag } from "./useValueDrag";
import { getZoom } from "./zoom";

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
  readOnly?: boolean; // shape shown, handles inert (e.g. while assigning)
  label?: string;
  wrapValue?: (stage: Stage, node: ReactNode) => ReactNode; // e.g. assign targets
}

const clamp = (v: number) => Math.max(0, Math.min(MAX, Math.round(v)));

const TAG_W = 42;
const TAG_H = 18;
const TAG_DRAG_PX = 160; // drag for the whole range
const TAG_STRIP = TAG_H + 8;

interface TagProps {
  stage: Stage;
  value: number;
  x: number;
  y: number;
  disabled?: boolean;
  onChange: (raw: number) => void;
}

// One stage's value inside the graph: "A 13".
function EnvTag(p: TagProps) {
  const drag = useValueDrag<HTMLDivElement>({
    value: p.value, max: MAX, onChange: p.onChange, defaultValue: 0, axis: "y", length: TAG_DRAG_PX, disabled: p.disabled,
  });
  const label = p.stage.toUpperCase();
  const text = p.disabled ? "–" : String(p.value);
  return (
    <div ref={drag.ref} className="envtag" role="slider" aria-label={label} aria-valuemin={0} aria-valuemax={MAX}
      aria-valuenow={p.value} aria-valuetext={text} onPointerDown={drag.onPointerDown} onDoubleClick={drag.onDoubleClick}
      style={{ left: p.x, top: p.y, width: TAG_W, height: TAG_H }}>
      {label} <b>{text}</b>
    </div>
  );
}

// Where the graph's corners are, in px.
interface Geometry {
  seg: number; // a stage's width at full value
  top: number;
  floor: number;
  ax: number;
  dx: number;
  sy: number;
  sx: number;
  rx: number;
}

function geometry(p: EnvelopeProps, W: number, H: number): Geometry {
  const seg = (W - 2 * PAD) / 4;
  const top = PAD;
  const floor = H - PAD - TAG_STRIP; // the values sit in a strip under the graph's floor
  const ax = PAD + (p.a / MAX) * seg;
  const dx = ax + (p.d / MAX) * seg;
  const sx = dx + seg * 0.6;
  return { seg, top, floor, ax, dx, sx, sy: floor - ((floor - top) * p.s) / MAX, rx: sx + (p.r / MAX) * seg };
}

const isInert = (p: EnvelopeProps) => Boolean(p.disabled || p.readOnly);

// Dragging a handle: sideways for its stage's time, and (the decay handle) up and down for sustain.
function useStageDrag(p: EnvelopeProps, g: Geometry) {
  const props = useRef(p);
  props.current = p;
  return (stage: "a" | "d" | "r") => (e: ReactPointerEvent<SVGCircleElement>) => {
    if (isInert(props.current) || e.button !== 0) return;
    const el = e.currentTarget;
    el.setPointerCapture(e.pointerId);
    let fx = props.current[stage];
    let fy = props.current.s;
    let last = { x: e.clientX, y: e.clientY };
    const move = (ev: PointerEvent) => {
      const k = ((ev.shiftKey ? FINE : 1) / getZoom()) * MAX;
      fx = Math.max(0, Math.min(MAX, fx + ((ev.clientX - last.x) / g.seg) * k));
      fy = Math.max(0, Math.min(MAX, fy - ((ev.clientY - last.y) / (g.floor - g.top)) * k));
      last = { x: ev.clientX, y: ev.clientY };
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
}

interface HandleProps {
  x: number;
  y: number;
  onPointerDown: (e: ReactPointerEvent<SVGCircleElement>) => void;
  onReset: () => void;
}

function Handle(h: HandleProps) {
  return (
    <g className="handle">
      <circle className="dot" cx={h.x} cy={h.y} r={4} />
      <circle className="hit" cx={h.x} cy={h.y} r={9} onPointerDown={h.onPointerDown} onDoubleClick={h.onReset} />
    </g>
  );
}

// The four values in their strip, each under the middle of its stage.
function EnvTags({ p, g, width }: { p: EnvelopeProps; g: Geometry; width: number }) {
  const xs = spreadTags({
    centres: [(PAD + g.ax) / 2, (g.ax + g.dx) / 2, (g.dx + g.sx) / 2, (g.sx + g.rx) / 2],
    width: TAG_W, gap: 4, left: PAD, right: width - PAD,
  });
  return STAGES.map((k, i) => {
    const node = <EnvTag stage={k} value={p[k]} x={xs[i]!} y={g.floor + 6} disabled={p.disabled}
      onChange={(v) => p.onChange(k, v)} />;
    return <span key={k}>{p.wrapValue ? p.wrapValue(k, node) : node}</span>;
  });
}

export function EnvelopeEditor(p: EnvelopeProps) {
  const W = p.width ?? 310;
  const H = p.height ?? 110;
  const g = geometry(p, W, H);
  const startDrag = useStageDrag(p, g);
  const handle = (stage: "a" | "d" | "r", x: number, y: number) => (
    <Handle x={x} y={y} onPointerDown={startDrag(stage)} onReset={() => !isInert(p) && p.onChange(stage, 0)} />
  );
  return (
    <div className={`env ${p.disabled ? "disabled" : ""}`}>
      <svg width={W} height={H}>
        <rect className="well" width={W} height={H} />
        <line className="axis" x1={0} x2={W} y1={g.floor} y2={g.floor} />
        {p.label && (
          <text className="glabel" x={W - 6} y={16} textAnchor="end">
            {p.label}
          </text>
        )}
        {!p.disabled && (
          <>
            <path className="shape" d={`M${PAD} ${g.floor} L${g.ax} ${g.top} L${g.dx} ${g.sy} L${g.sx} ${g.sy} L${g.rx} ${g.floor}`} />
            {handle("a", g.ax, g.top)}
            {handle("d", g.dx, g.sy)}
            {handle("r", g.rx, g.floor)}
          </>
        )}
      </svg>
      <EnvTags p={p} g={g} width={W} />
    </div>
  );
}
