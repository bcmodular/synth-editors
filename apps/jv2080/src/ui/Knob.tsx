// Knob and channel fader, adapted from the SP-404 app (apps/sp404/src/fx/controls.tsx and ui/controls.tsx) to take
// any raw range. Drag up / down (Shift = fine), wheel steps, double-click resets.
import { useValueDrag } from "./useValueDrag";

export interface RangeProps {
  value: number;
  min?: number;
  max: number;
  onChange: (raw: number) => void;
  reset?: number; // double-click target; default min
}

const fraction = (p: RangeProps) => (p.value - (p.min ?? 0)) / Math.max(1, p.max - (p.min ?? 0));

// `color` paints the cap (the pointer turns dark to stay visible); without it the cap is the plain grey one.
export function Knob(p: RangeProps & { label: string; text: string; color?: string }) {
  const drag = useValueDrag<HTMLDivElement>({
    value: p.value, min: p.min, max: p.max, onChange: p.onChange, defaultValue: p.reset ?? p.min ?? 0, axis: "y",
    length: 160,
  });
  return (
    <div className={`kn ${p.color ? "col" : ""}`} style={p.color ? { ["--kc" as string]: p.color } : undefined} ref={drag.ref} role="slider" aria-label={p.label} aria-valuemin={p.min ?? 0}
      aria-valuemax={p.max} aria-valuenow={p.value} aria-valuetext={p.text}
      onPointerDown={drag.onPointerDown} onDoubleClick={drag.onDoubleClick}>
      <i style={{ ["--a" as string]: `${-135 + fraction(p) * 270}deg` }} />
      <span className="lbl">{p.label}</span>
      <em>{p.text}</em>
    </div>
  );
}

// Vertical fader with a cap. `color` tints the fill and cap; `dim` draws it muted (the cap stays at the level).
export function ChannelFader(p: RangeProps & { label: string; color: string; dim?: boolean }) {
  const drag = useValueDrag<HTMLDivElement>({
    value: p.value, min: p.min, max: p.max, onChange: p.onChange, defaultValue: p.reset ?? p.max, axis: "y",
  });
  const pos = fraction(p);
  return (
    <div
      ref={drag.ref}
      className={`fader ${p.dim ? "muted" : ""}`}
      style={{ ["--fc" as string]: p.color, ["--pos" as string]: pos, ["--fillpos" as string]: p.dim ? 0 : pos }}
      role="slider"
      aria-label={p.label}
      aria-valuemin={p.min ?? 0}
      aria-valuemax={p.max}
      aria-valuenow={p.value}
      onPointerDown={drag.onPointerDown}
      onDoubleClick={drag.onDoubleClick}
    >
      <div className="scale" />
      <div className="slot" />
      <div className="fill" />
      <div className="knobcap" />
    </div>
  );
}
