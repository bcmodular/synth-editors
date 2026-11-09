// Value interaction: relative drag (Shift = fine), double-click reset, wheel steps. Adapted from the TB-3
// app's hook, with a minimum (pan runs 13–115).
import { useEffect, useRef } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { getZoom } from "./zoom";

const FINE = 0.15;
const WHEEL_PX_PER_STEP = 8;

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export interface ValueDragOptions {
  value: number;
  min?: number;
  max: number;
  onChange: (raw: number) => void;
  defaultValue: number;
  axis: "x" | "y";
  length?: number; // px of travel for the full range; default: the element's own size
  disabled?: boolean;
}

const elementSize = (el: Element, axis: "x" | "y"): number =>
  el instanceof HTMLElement ? (axis === "x" ? el.offsetWidth : el.offsetHeight) : 100;

// Pointer moves for one drag: relative to where it started, in the layout's own px (undoing the fit zoom).
function dragMover(opts: { current: ValueDragOptions }, start: { clientX: number; clientY: number }, size: number) {
  const along = (ev: { clientX: number; clientY: number }) => (opts.current.axis === "x" ? ev.clientX : ev.clientY);
  let last = along(start);
  let acc = opts.current.value;
  return (ev: PointerEvent) => {
    const { axis, min = 0, max, onChange } = opts.current;
    const length = opts.current.length ?? size;
    const pos = along(ev);
    const delta = (axis === "x" ? pos - last : last - pos) / getZoom() / length;
    last = pos;
    acc = clamp(acc + delta * (max - min) * (ev.shiftKey ? FINE : 1), min, max);
    const next = Math.round(acc);
    if (next !== opts.current.value) onChange(next);
  };
}

export function useValueDrag<T extends HTMLElement | SVGElement>(o: ValueDragOptions) {
  const opts = useRef(o);
  opts.current = o;
  const ref = useRef<T>(null);

  // Wheel needs a non-passive listener to stop the page scrolling.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let acc = 0;
    const onWheel = (e: Event) => {
      const w = e as WheelEvent;
      const { value, min = 0, max, onChange, disabled } = opts.current;
      if (disabled) return;
      w.preventDefault();
      // Mouse wheels report large deltas per notch; trackpads report many small ones.
      const d = Math.abs(w.deltaY) >= 40 ? Math.sign(w.deltaY) * WHEEL_PX_PER_STEP : w.deltaY;
      acc += d;
      const steps = Math.trunc(acc / WHEEL_PX_PER_STEP);
      if (!steps) return;
      acc -= steps * WHEEL_PX_PER_STEP;
      const next = clamp(value - steps, min, max);
      if (next === value) return;
      // Several wheel events can arrive before React re-renders with the new value.
      opts.current = { ...opts.current, value: next };
      onChange(next);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const onPointerDown = (e: ReactPointerEvent<T>) => {
    if (opts.current.disabled || e.button !== 0) return;
    const el = e.currentTarget;
    el.setPointerCapture(e.pointerId);
    const move = dragMover(opts, e, elementSize(el, opts.current.axis));
    const up = () => {
      el.removeEventListener("pointermove", move as EventListener);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
    };
    el.addEventListener("pointermove", move as EventListener);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
  };

  const onDoubleClick = () => {
    const { disabled, defaultValue, onChange } = opts.current;
    if (!disabled) onChange(defaultValue);
  };

  return { ref, onPointerDown, onDoubleClick };
}
