// Dragging a handle in a drawing: sideways and / or up-down movement turned into changes of raw values. Each axis
// gives the value it starts from, its range and how many px drag across the whole range; the values accumulate as
// floats and are reported rounded. Shift = fine. Movement is in the layout's own px (undoing the fit zoom).
import type { PointerEvent as ReactPointerEvent } from "react";
import { getZoom } from "./zoom";

const FINE = 0.15;

export interface DragAxis {
  value: number;
  min?: number;
  max: number;
  px: number; // drag distance for the full range
  onChange: (raw: number) => void;
  cc?: CcPick; // what a learned CC would drive along this axis (editor/ccTargets.ts)
}

export interface CcPick {
  target: string;
  label: string;
}

// While CC learn waits for a control (editor/useLearnPick.ts), pressing a handle hands what it sets to this instead of
// dragging it.
let picker: ((picks: CcPick[]) => void) | null = null;
export function setDragPicker(fn: typeof picker) {
  picker = fn;
}

const clamp = (v: number, a: DragAxis) => Math.max(a.min ?? 0, Math.min(a.max, v));

function follow(axis: DragAxis | undefined, start: number) {
  let acc = start;
  let last = axis ? Math.round(start) : 0;
  return (delta: number, fine: boolean) => {
    if (!axis) return;
    acc = clamp(acc + (delta / axis.px) * (axis.max - (axis.min ?? 0)) * (fine ? FINE : 1), axis);
    const next = Math.round(acc);
    if (next !== last) axis.onChange(next);
    last = next;
  };
}

// Up is more: `y` grows as the pointer moves up.
export function dragXY(e: ReactPointerEvent<Element>, axes: { x?: DragAxis; y?: DragAxis }) {
  if (e.button !== 0) return;
  e.stopPropagation();
  const picks = [axes.x?.cc, axes.y?.cc].filter((c): c is CcPick => c !== undefined);
  if (picker && picks.length) return picker(picks);
  const el = e.currentTarget;
  el.setPointerCapture(e.pointerId);
  const moveX = follow(axes.x, axes.x?.value ?? 0);
  const moveY = follow(axes.y, axes.y?.value ?? 0);
  let lastX = e.clientX;
  let lastY = e.clientY;
  const move = (ev: PointerEvent) => {
    const zoom = getZoom();
    moveX((ev.clientX - lastX) / zoom, ev.shiftKey);
    moveY((lastY - ev.clientY) / zoom, ev.shiftKey);
    lastX = ev.clientX;
    lastY = ev.clientY;
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
