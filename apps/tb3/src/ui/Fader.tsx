// Horizontal fader in the style of the knobs (after the JV-2080's channel faders): a recessed slot, the level in the
// section's colour (from the centre for bipolar values), a grip cap with a coloured line, and the value beside it.
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
  label?: string; // for screen readers
  className?: string;
}

// Fractions (0–1) of the slot: where the fill starts, how long it is, and where the cap sits.
export function faderFill(p: Pick<FaderProps, "value" | "max" | "center">) {
  const pos = Math.max(0, Math.min(1, p.value / Math.max(1, p.max)));
  if (p.center === undefined) return { start: 0, size: pos, pos };
  const c = p.center / p.max;
  return { start: Math.min(pos, c), size: Math.abs(pos - c), pos };
}

function fillClass(p: FaderProps) {
  if (p.off) return "off";
  if (p.signColors && p.center !== undefined && p.value < p.center) return "neg";
  return "";
}

const classes = (p: FaderProps, stretch: boolean) => [
  "hf", stretch ? "fill" : "", p.center !== undefined ? "bi" : "", fillClass(p), p.disabled ? "disabled" : "",
  p.className ?? "",
];

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
  const f = faderFill(p);
  const text = p.disabled ? "" : (p.format ?? String)(p.value);
  const vars = { "--s": f.start, "--z": f.size, "--p": f.pos, "--c": p.center === undefined ? 0 : p.center / p.max };
  return (
    <div ref={drag.ref} className={classes(p, stretch).join(" ")} style={{ width, ...vars }} role="slider"
      aria-label={p.label} aria-valuemin={0} aria-valuemax={p.max} aria-valuenow={p.value} aria-valuetext={text}
      onPointerDown={drag.onPointerDown} onDoubleClick={drag.onDoubleClick}>
      <i className={fillClass(p)} />
      <b />
      <em>{text}</em>
    </div>
  );
}
