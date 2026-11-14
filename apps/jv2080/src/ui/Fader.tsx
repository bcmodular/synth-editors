// Copied from apps/tb3/src/ui/Fader.tsx (HFader only). Short, fat faders. The fill grows from 0, or from the centre line for bipolar values.
import { useValueDrag } from "./useValueDrag";

export interface FaderProps {
  value: number;
  max: number;
  onChange: (raw: number) => void;
  format?: (raw: number) => string;
  center?: number; // set for bipolar values: fill grows from here
  defaultValue?: number; // double-click target; defaults to center ?? 0
  off?: boolean; // source switched off: dim fill, keep level
  disabled?: boolean;
  signColors?: boolean; // negative fill in the alt colour (cross mod)
  className?: string;
}

function fill(value: number, max: number, center: number | undefined) {
  const p = (value / max) * 100;
  if (center === undefined) return { start: 0, size: p };
  const c = (center / max) * 100;
  return { start: Math.min(p, c), size: Math.abs(p - c) };
}

const centerPct = (p: FaderProps) => (p.center === undefined ? undefined : `${(p.center / p.max) * 100}%`);

function fillClass(p: FaderProps) {
  if (p.off) return "off";
  if (p.signColors && p.center !== undefined && p.value < p.center) return "neg";
  return "";
}

// `width: "fill"` stretches the fader across the space its row leaves for it.
export function HFader(p: FaderProps & { width?: number | "fill" }) {
  const stretch = p.width === "fill";
  const width = p.width === "fill" ? undefined : (p.width ?? 140);
  const drag = useValueDrag<HTMLDivElement>({
    value: p.value,
    max: p.max,
    onChange: p.onChange,
    defaultValue: p.defaultValue ?? p.center ?? 0,
    axis: "x",
    length: width,
    disabled: p.disabled,
  });
  const f = fill(p.value, p.max, p.center);
  return (
    <div
      ref={drag.ref}
      className={`hf ${stretch ? "fill" : ""} ${p.center !== undefined ? "bi" : ""} ${p.disabled ? "disabled" : ""} ${p.className ?? ""}`}
      style={{ width, ["--c" as string]: centerPct(p) }}
      onPointerDown={drag.onPointerDown}
      onDoubleClick={drag.onDoubleClick}
    >
      <i className={fillClass(p)} style={{ left: `${f.start}%`, width: `${f.size}%` }} />
      <em>{p.disabled ? "" : (p.format ?? String)(p.value)}</em>
    </div>
  );
}
