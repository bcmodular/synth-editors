// Short, fat faders. The fill grows from 0, or from the centre line for bipolar values.
import type { ReactNode } from "react";
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
  signColors?: boolean; // negative fill in cyan (cross mod)
  className?: string;
}

function fill(value: number, max: number, center: number | undefined) {
  const p = (value / max) * 100;
  if (center === undefined) return { start: 0, size: p };
  const c = (center / max) * 100;
  return { start: Math.min(p, c), size: Math.abs(p - c) };
}

function fillClass(p: FaderProps) {
  if (p.off) return "off";
  if (p.signColors && p.center !== undefined && p.value < p.center) return "neg";
  return "";
}

export function HFader(p: FaderProps & { width?: number }) {
  const width = p.width ?? 140;
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
      className={`hf ${p.center !== undefined ? "bi" : ""} ${p.disabled ? "disabled" : ""} ${p.className ?? ""}`}
      style={{ width }}
      onPointerDown={drag.onPointerDown}
      onDoubleClick={drag.onDoubleClick}
    >
      <i className={fillClass(p)} style={{ left: `${f.start}%`, width: `${f.size}%` }} />
      <em>{p.disabled ? "" : (p.format ?? String)(p.value)}</em>
    </div>
  );
}

export interface VFaderProps extends FaderProps {
  height?: number;
  color?: "led" | "cyan";
  label?: ReactNode;
  led?: { on: boolean; onToggle: () => void }; // LED cap = on/off switch
}

export function VFader(p: VFaderProps) {
  const height = p.height ?? 100;
  const drag = useValueDrag<HTMLDivElement>({
    value: p.value,
    max: p.max,
    onChange: p.onChange,
    defaultValue: p.defaultValue ?? p.center ?? 0,
    axis: "y",
    length: height,
    disabled: p.disabled,
  });
  const f = fill(p.value, p.max, p.center);
  return (
    <div className="vcell">
      {p.led && (
        <button
          className={`ledcap ${p.led.on ? "on" : ""}`}
          disabled={p.disabled}
          onClick={p.led.onToggle}
          aria-label="on/off"
        />
      )}
      <div
        ref={drag.ref}
        className={`vf ${p.center !== undefined ? "bi" : ""} ${p.color === "cyan" ? "cyan" : ""} ${p.disabled ? "disabled" : ""}`}
        style={{ height }}
        onPointerDown={drag.onPointerDown}
        onDoubleClick={drag.onDoubleClick}
      >
        <i className={fillClass(p)} style={{ bottom: `${f.start}%`, height: `${f.size}%` }} />
      </div>
      <span className="v">{p.disabled ? "–" : (p.format ?? String)(p.value)}</span>
      {p.label}
    </div>
  );
}
