// The AHR editor: a pad's attack, hold and release as an envelope with a handle on each corner (drag sideways,
// Shift for fine, double-click to reset), plus a readout per value. Opens over the mixer from a strip's thumbnail.

import { useRef } from "react";
import type { MixerPad, MixField } from "../core/mixer";
import { useDismiss } from "../ui/useDismiss";
import { useValueDrag } from "../ui/useValueDrag";
import { padLabel } from "./banks";

// Attack and release run 0–127, hold 1–100 (as the device stores them).
export const AHR_RANGES = {
  attack: { min: 0, max: 127, reset: 0 },
  hold: { min: 1, max: 100, reset: 100 },
  release: { min: 0, max: 127, reset: 0 },
} as const;
type AhrField = keyof typeof AHR_RANGES;
const AHR_RESET = { attack: AHR_RANGES.attack.reset, hold: AHR_RANGES.hold.reset, release: AHR_RANGES.release.reset };

const W = 360;
const H = 140;
const TOP = 16;
const BOTTOM = H - 14;
const SEGMENT = (W - 24) / 3; // each value's full range spans a third of the width

// Corner x positions for the envelope: attack end, hold end, release end.
export function ahrCorners({ attack, hold, release }: { attack: number; hold: number; release: number }) {
  const a = 8 + (attack / AHR_RANGES.attack.max) * SEGMENT;
  const h = a + (hold / AHR_RANGES.hold.max) * SEGMENT;
  const r = h + (release / AHR_RANGES.release.max) * SEGMENT;
  return { a, h, r };
}

interface HandleProps {
  field: AhrField;
  x: number;
  y: number;
  value: number;
  label: string;
  onChange: (v: number) => void;
}

function Handle({ field, x, y, value, label, onChange }: HandleProps) {
  const range = AHR_RANGES[field];
  const drag = useValueDrag<SVGCircleElement>({
    value, min: range.min, max: range.max, onChange, defaultValue: range.reset, axis: "x", length: SEGMENT,
  });
  return (
    <circle className="handle" cx={x} cy={y} r={7} ref={drag.ref} role="slider" aria-label={label}
      aria-valuemin={range.min} aria-valuemax={range.max} aria-valuenow={value}
      onPointerDown={drag.onPointerDown} onDoubleClick={drag.onDoubleClick} />
  );
}

export interface AhrEditorProps {
  pad: MixerPad;
  onValue: (pad: number, field: MixField, value: number) => void;
  onValues: (pad: number, values: Partial<MixerPad["mix"]>) => void;
  onClose: () => void;
}

export function AhrEditor({ pad, onValue, onValues, onClose }: AhrEditorProps) {
  const panel = useRef<HTMLDivElement>(null);
  useDismiss(panel, onClose);
  const { attack, hold, release } = pad.mix;
  const { a, h, r } = ahrCorners(pad.mix);
  const label = padLabel(pad.pad);
  const set = (field: AhrField) => (v: number) => onValue(pad.pad, field, v);
  const reset = () => onValues(pad.pad, AHR_RESET);
  return (
    <div className="ahr-editor" ref={panel} role="dialog" aria-label={`${label} envelope`}>
      <div className="ahr-head">
        <span className="h">{label} · {pad.name}</span>
        <span className="sp" />
        <button className="btn" onClick={reset} title="Attack 0, hold 100, release 0">RESET</button>
        <button className="btn" onClick={onClose} aria-label="Close envelope">CLOSE</button>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H}>
        <line className="base" x1={0} y1={BOTTOM} x2={W} y2={BOTTOM} />
        <polygon className="env" points={`8,${BOTTOM} ${a},${TOP} ${h},${TOP} ${r},${BOTTOM}`} />
        <Handle field="attack" x={a} y={TOP} value={attack} label={`${label} attack`} onChange={set("attack")} />
        <Handle field="hold" x={h} y={TOP} value={hold} label={`${label} hold`} onChange={set("hold")} />
        <Handle field="release" x={r} y={BOTTOM} value={release} label={`${label} release`} onChange={set("release")} />
      </svg>
      <div className="ahr-values">
        <span>ATTACK <b>{attack}</b></span>
        <span>HOLD <b>{hold}</b></span>
        <span>RELEASE <b>{release}</b></span>
      </div>
      <div className="hint">Drag the handles sideways (Shift for fine); double-click one to reset it.</div>
    </div>
  );
}
