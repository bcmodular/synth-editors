// Dragging a handle in a drawing (after the SP-404's views/useHandleDrag.ts): sideways moves one value, up and down
// another, relative to where the drag started (Shift = fine). Each axis has its own range, crossed in `px` layout px.
import type { PointerEvent as ReactPointerEvent } from "react";
import { getZoom } from "./zoom";

export interface DragAxis {
  get: () => number; // the value now (read when the drag starts)
  min?: number; // default 0
  max: number;
  set: (raw: number) => void;
  px?: number; // layout px for the whole range (default 160); negative runs the axis backwards
}

export interface HandleDrag {
  x?: DragAxis;
  y?: DragAxis;
}

const FINE = 0.15;
const DEFAULT_PX = 160;

function follow(axis: DragAxis | undefined) {
  if (!axis) return () => undefined;
  const min = axis.min ?? 0;
  const perPx = (axis.max - min) / (axis.px ?? DEFAULT_PX);
  let acc = axis.get();
  let last = Math.round(acc);
  return (px: number, fine: boolean) => {
    acc = Math.max(min, Math.min(axis.max, acc + px * perPx * (fine ? FINE : 1)));
    const raw = Math.round(acc);
    if (raw !== last) axis.set(raw);
    last = raw;
  };
}

export function startHandleDrag(drag: HandleDrag, e: ReactPointerEvent<Element>) {
  if (e.button !== 0) return;
  const el = e.currentTarget;
  el.setPointerCapture(e.pointerId);
  let pos = { x: e.clientX, y: e.clientY };
  const x = follow(drag.x);
  const y = follow(drag.y);
  const move = (ev: PointerEvent) => {
    const z = getZoom();
    x((ev.clientX - pos.x) / z, ev.shiftKey);
    y((pos.y - ev.clientY) / z, ev.shiftKey);
    pos = { x: ev.clientX, y: ev.clientY };
  };
  const up = () => {
    el.removeEventListener("pointermove", move as EventListener);
    el.removeEventListener("pointerup", up);
    el.removeEventListener("pointercancel", up);
  };
  el.addEventListener("pointermove", move as EventListener);
  el.addEventListener("pointerup", up);
  el.addEventListener("pointercancel", up);
}
