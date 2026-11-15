// Where a knob's pointer and value arc sit: −135° (empty) to +135° (full), 0° straight up. A bipolar value's arc
// runs from its centre, so +10 and −10 read as either side of the middle.

export interface KnobRange {
  value: number;
  max: number;
  center?: number; // set for bipolar values
}

const SWEEP = 270;
const angleOf = (raw: number, max: number) => -135 + (Math.max(0, Math.min(max, raw)) / Math.max(1, max)) * SWEEP;

export interface KnobArc {
  pointer: number; // degrees
  from: number; // the arc's start, degrees
  length: number; // degrees, ≥ 0
}

export function knobArc(k: KnobRange): KnobArc {
  const pointer = angleOf(k.value, k.max);
  const origin = k.center === undefined ? -135 : angleOf(k.center, k.max);
  return { pointer, from: Math.min(origin, pointer), length: Math.abs(pointer - origin) };
}
