// LFO preview: the summed output of the five waves, for drawing. Qualitative only — the TB-3's
// rate (Hz / BPM) and delay time mappings are unknown, so there are no real time units here.

export interface LfoShapeInput {
  saw: number; // wave levels, raw 0..127
  sqr: number;
  tri: number;
  sin: number;
  sh: number;
  rate: number; // 0..127 → 1..6 visible cycles
  delay: number; // 0..127 → fade-in over the first 0..50% of the window
  cvOffset: number; // 0..127 → vertical shift
}

// Fixed pseudo-random sample-and-hold sequence, one value per cycle.
const SH_STEPS = [0.6, -0.3, 0.9, -0.8, 0.2, -0.6, 0.4, -0.1];

type Wave = "saw" | "sqr" | "tri" | "sin";

function wave(kind: Wave, phase: number): number {
  switch (kind) {
    case "saw":
      return 2 * phase - 1;
    case "sqr":
      return phase < 0.5 ? 1 : -1;
    case "tri":
      return phase < 0.5 ? 4 * phase - 1 : 3 - 4 * phase;
    case "sin":
      return Math.sin(2 * Math.PI * phase);
  }
}

export const lfoCycles = (rate: number): number => 1 + (rate / 127) * 5;

// Unnormalised sample at window position t (0..1).
export function lfoSample(p: LfoShapeInput, t: number): number {
  const pos = t * lfoCycles(p.rate);
  const phase = pos % 1;
  const cycle = Math.floor(pos);
  let y = 0;
  for (const k of ["saw", "sqr", "tri", "sin"] as const) y += (p[k] / 127) * wave(k, phase);
  y += (p.sh / 127) * SH_STEPS[cycle % SH_STEPS.length]!;
  const delayEnd = (p.delay / 127) * 0.5;
  const env = delayEnd > 0 ? Math.min(1, t / delayEnd) : 1;
  return y * env + p.cvOffset / 127;
}

// `n + 1` samples across the window, scaled so the largest excursion is ±1 (never amplified
// beyond a single full-level wave, so small mixes look small).
export function lfoShape(p: LfoShapeInput, n = 240): number[] {
  const ys = Array.from({ length: n + 1 }, (_, i) => lfoSample(p, i / n));
  const peak = Math.max(1, ...ys.map(Math.abs));
  return ys.map((y) => y / peak);
}
