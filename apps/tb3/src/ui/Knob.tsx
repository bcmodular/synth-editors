// An encoder (after the JV-2080 app's ui/Knob.tsx, itself from the SP-404's): a cap in the section's colour (--led)
// with a dark pointer, a ring showing the value (from the centre for bipolar ones), the label and value under it.
// Drag up and down (Shift = fine), scroll to step, double-click to reset.
import { knobArc } from "./knobArc";
import { useValueDrag } from "./useValueDrag";

export interface KnobProps {
  label: string;
  value: number;
  max: number;
  onChange: (raw: number) => void;
  format?: (raw: number) => string;
  center?: number; // bipolar: the ring fills from here, and double-click returns here
  defaultValue?: number; // double-click target; default center ?? 0
  disabled?: boolean;
  dim?: boolean; // its source is switched off
  size?: "xs" | "s" | "m"; // m (default), or smaller for tight rows
  side?: boolean; // label and value beside the knob, not under it
  bare?: boolean; // no label (a row or column names it)
  signColors?: boolean; // below the centre in the alt colour (cross mod)
}

const DRAG_PX = 160; // drag for the whole range

export function Knob(p: KnobProps) {
  const drag = useValueDrag<HTMLDivElement>({
    value: p.value,
    max: p.max,
    onChange: p.onChange,
    defaultValue: p.defaultValue ?? p.center ?? 0,
    axis: "y",
    length: DRAG_PX,
    disabled: p.disabled,
  });
  const arc = knobArc(p);
  const text = p.disabled ? "–" : (p.format ?? String)(p.value);
  const neg = p.signColors && p.center !== undefined && p.value < p.center;
  const cls = ["kn", p.size ?? "m", p.side ? "beside" : "", p.disabled ? "disabled" : "", p.dim ? "dim" : "", neg ? "neg" : ""];
  return (
    <div ref={drag.ref} className={cls.join(" ")} role="slider" aria-label={p.label} aria-valuemin={0} aria-valuemax={p.max}
      aria-valuenow={p.value} aria-valuetext={text} onPointerDown={drag.onPointerDown} onDoubleClick={drag.onDoubleClick}>
      <span className="dial" style={{ ["--from" as string]: `${arc.from}deg`, ["--len" as string]: `${arc.length}deg` }}>
        <i style={{ ["--a" as string]: `${arc.pointer}deg` }} />
      </span>
      {!p.bare && <span className="lbl">{p.label}</span>}
      <em>{text}</em>
    </div>
  );
}
