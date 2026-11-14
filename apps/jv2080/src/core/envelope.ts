// The JV's envelopes as drawable shapes. Each has four times and up to four levels: it starts at 0, moves to L1
// over T1, L2 over T2, L3 over T3 and holds L3 while the key is down; after note-off it moves to L4 over T4. The amp
// envelope has no L4: it always ends at 0. Pitch levels are bipolar (raw 0–126, 63 = no change).

export interface EnvelopeSpec {
  times: readonly number[]; // T1–T4, raw 0–127
  levels: readonly number[]; // L1–L4 (or L1–L3 when the envelope ends at 0), raw
  levelMax: number; // 127, or 126 for bipolar
  center?: number; // set for bipolar levels: the raw value drawn on the centre line
}

export interface EnvelopeNode {
  t: number; // time from the start, in raw time units (sustain adds `sustain` units)
  v: number; // level: 0…1, or −1…1 for bipolar
}

// The level a raw value is drawn at.
export function envelopeLevel(spec: EnvelopeSpec, raw: number): number {
  if (spec.center === undefined) return raw / spec.levelMax;
  return (raw - spec.center) / spec.center;
}

// The raw value at a drawn level, clamped to the parameter's range.
export function rawAtLevel(spec: EnvelopeSpec, v: number): number {
  const raw = spec.center === undefined ? v * spec.levelMax : spec.center + v * spec.center;
  return Math.max(0, Math.min(spec.levelMax, Math.round(raw)));
}

// Start, the end of each stage, and the sustain hold before the release stage. Five or six nodes: start, T1, T2,
// T3, the end of the hold, then T4.
export function envelopeNodes(spec: EnvelopeSpec, sustain: number): EnvelopeNode[] {
  const level = (i: number) => (i < spec.levels.length ? envelopeLevel(spec, spec.levels[i]!) : 0);
  const nodes: EnvelopeNode[] = [{ t: 0, v: 0 }];
  let t = 0;
  for (let i = 0; i < 3; i++) {
    t += spec.times[i] ?? 0;
    nodes.push({ t, v: level(i) });
  }
  t += sustain;
  nodes.push({ t, v: level(2) });
  t += spec.times[3] ?? 0;
  nodes.push({ t, v: level(3) });
  return nodes;
}
