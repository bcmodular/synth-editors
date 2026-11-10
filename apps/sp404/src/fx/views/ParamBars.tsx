// The drawing for an effect without one of its own yet: a bar per parameter, its height the raw value, with the
// value the SP-404 shows. Drag a bar up or down; double-click resets it to the middle.

import { displayValue, isSyncOn, syncParam } from "../../core/fx";
import type { FxParam } from "../../core/fxTypes";
import { useValueDrag } from "../../ui/useValueDrag";
import type { ViewProps } from "./types";

interface BarProps {
  p: FxParam;
  slot: number;
  raw: number;
  text: string;
  x: number;
  w: number;
  height: number;
  onChange: (raw: number) => void;
}

const TOP = 18;
const CHAR_PX = 5.4; // width of one label character at the drawing's 9 px

// A label that fits its slot: the whole name, else its first word, else as much as fits.
export function fitLabel(label: string, width: number): string {
  const max = Math.max(3, Math.floor(width / CHAR_PX));
  if (label.length <= max) return label;
  const first = label.split(" ")[0] ?? label;
  return first.length <= max ? first : first.slice(0, max);
}
const BOTTOM_PAD = 16;

function Bar({ p, slot, raw, text, x, w, height, onChange }: BarProps) {
  const travel = height - TOP - BOTTOM_PAD;
  const drag = useValueDrag<SVGRectElement>({ value: raw, max: 127, onChange, defaultValue: 64, axis: "y", length: travel });
  const h = (raw / 127) * travel;
  return (
    <g>
      <rect className="dimf" x={x} y={TOP} width={w} height={travel} />
      <rect className="af" x={x} y={TOP + travel - h} width={w} height={h} opacity={0.75} />
      <text className="gl" x={x + w / 2} y={height - 4} textAnchor="middle">{fitLabel(p.label, slot - 2)}</text>
      <text className="hl" x={x + w / 2} y={12} textAnchor="middle">{text}</text>
      <rect ref={drag.ref} className="drag" x={x} y={TOP} width={w} height={travel} fill="transparent"
        onPointerDown={drag.onPointerDown} onDoubleClick={drag.onDoubleClick} />
    </g>
  );
}

export function ParamBars({ fx, values, onValue, width, height }: ViewProps) {
  const sync = syncParam(fx);
  const syncOn = sync ? isSyncOn(values[fx.params.indexOf(sync)] ?? 0) : false;
  const slot = width / fx.params.length;
  const w = Math.min(28, slot - 10);
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      {fx.params.map((p, i) => (
        <Bar key={p.cc} p={p} slot={slot} raw={values[i] ?? 0} text={displayValue(p, values[i] ?? 0, syncOn)}
          x={i * slot + (slot - w) / 2} w={w} height={height} onChange={(raw) => onValue(i, raw)} />
      ))}
    </svg>
  );
}
