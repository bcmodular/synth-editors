// Dragging a handle in an effect's drawing: sideways moves one parameter, up and down another, each by `scale` raw
// steps per layout px (Shift for fine), relative to where the drag started, as in the designs.

import { useRef, type PointerEvent as ReactPointerEvent } from "react";
import { getZoom } from "../../ui/zoom";

export interface DragAxis {
  index: number; // the parameter it moves
  scale?: number; // raw steps per px (default 0.5)
}

export interface HandleDrag {
  x?: DragAxis;
  y?: DragAxis;
}

const FINE = 0.15;
const clamp7 = (v: number) => Math.max(0, Math.min(127, v));

interface Axes {
  values: readonly number[];
  onValue: (index: number, raw: number) => void;
}

function startDrag(drag: HandleDrag, { values, onValue }: Axes, e: ReactPointerEvent<SVGElement>) {
  const el = e.currentTarget;
  el.setPointerCapture(e.pointerId);
  let last = { x: e.clientX, y: e.clientY };
  const acc = { x: drag.x ? (values[drag.x.index] ?? 0) : 0, y: drag.y ? (values[drag.y.index] ?? 0) : 0 };
  const apply = (axis: DragAxis | undefined, key: "x" | "y", px: number, fine: boolean) => {
    if (!axis) return;
    acc[key] = clamp7(acc[key] + px * (axis.scale ?? 0.5) * (fine ? FINE : 1));
    onValue(axis.index, Math.round(acc[key]));
  };
  const move = (ev: PointerEvent) => {
    const z = getZoom();
    apply(drag.x, "x", (ev.clientX - last.x) / z, ev.shiftKey);
    apply(drag.y, "y", (last.y - ev.clientY) / z, ev.shiftKey);
    last = { x: ev.clientX, y: ev.clientY };
  };
  const up = () => {
    el.removeEventListener("pointermove", move as EventListener);
    el.removeEventListener("pointerup", up);
  };
  el.addEventListener("pointermove", move as EventListener);
  el.addEventListener("pointerup", up);
}

export function useHandleDrag(axes: Axes) {
  const latest = useRef(axes);
  latest.current = axes;
  return (drag: HandleDrag) => (e: ReactPointerEvent<SVGElement>) => {
    if (e.button === 0) startDrag(drag, latest.current, e);
  };
}
