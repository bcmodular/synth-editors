// Mixer controls drawn as in the Layout D mockup: a channel fader with a cap and a pan knob.
import { useValueDrag } from "./useValueDrag";

export interface ValueProps {
  value: number;
  onChange: (value: number) => void;
  label: string; // accessible name, e.g. "A1 level"
}

// Vertical fader, 0–127. `color` is the bank colour; `dim` draws it as muted (the cap stays at the level).
export function ChannelFader(p: ValueProps & { color: string; dim?: boolean; defaultValue?: number }) {
  const drag = useValueDrag<HTMLDivElement>({
    value: p.value, max: 127, onChange: p.onChange, defaultValue: p.defaultValue ?? 127, axis: "y",
  });
  const pos = p.value / 127;
  return (
    <div
      ref={drag.ref}
      className={`fader ${p.dim ? "muted" : ""}`}
      style={{ ["--fc" as string]: p.color, ["--pos" as string]: pos, ["--fillpos" as string]: p.dim ? 0 : pos }}
      role="slider"
      aria-label={p.label}
      aria-valuemin={0}
      aria-valuemax={127}
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

// Pan as the device sends it: 14–114, centre 64, shown L50–R50. The SP-404 resets 13 or 115 (L51/R51) to centre.
export const PAN_MIN = 14;
export const PAN_MAX = 114;
export const PAN_CENTRE = 64;

export function panText(raw: number): string {
  const v = raw - PAN_CENTRE;
  if (v === 0) return "C";
  return v < 0 ? `L${-v}` : `R${v}`;
}

export function PanKnob(p: ValueProps) {
  const drag = useValueDrag<HTMLDivElement>({
    value: p.value, min: PAN_MIN, max: PAN_MAX, onChange: p.onChange, defaultValue: PAN_CENTRE, axis: "y", length: 120,
  });
  const angle = ((p.value - PAN_CENTRE) / (PAN_MAX - PAN_CENTRE)) * 135;
  return (
    <div
      ref={drag.ref}
      className="pan"
      style={{ ["--a" as string]: `${angle}deg` }}
      role="slider"
      aria-label={p.label}
      aria-valuemin={PAN_MIN}
      aria-valuemax={PAN_MAX}
      aria-valuenow={p.value}
      aria-valuetext={panText(p.value)}
      onPointerDown={drag.onPointerDown}
      onDoubleClick={drag.onDoubleClick}
    />
  );
}
