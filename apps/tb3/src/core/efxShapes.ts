// Shapes for the EFX drawings (editor/efx/): compressor transfer curve, LFO waves, delay repeats, reverb tail.
// They make settings readable; they aren't measurements of the TB-3. Where the TB-3's mapping is known (threshold,
// ratio and gain in dB, pitch in semitones, reverb time) it is used; the rest is a plausible stand-in.
import { BPM_DIVS, CS_RATIOS, TR_TYPES } from "./display";

// ---- compressor

export interface CompSettings {
  threshold: number; // raw 0–40 → −40…0 dB
  ratio: number; // raw 0–13 → CS_RATIOS
  knee: number; // raw 0–9: 0 = hard, else soft
  gain: number; // raw 0–80 → −40…+40 dB
}

export const KNEE_DB_PER_STEP = 2; // soft-knee width per KNEE step (a guess)

// "1:2.5" → 2.5, "1:INF" → Infinity.
export function ratioOf(s: Pick<CompSettings, "ratio">): number {
  const label = CS_RATIOS[Math.min(s.ratio, CS_RATIOS.length - 1)]!;
  const v = label.slice(2);
  return v === "INF" ? Infinity : Number(v);
}

// Output level (dB) for an input level (dB): a soft-knee compressor with makeup gain.
export function compOut(s: CompSettings, inDb: number): number {
  const t = s.threshold - 40;
  const slope = 1 - 1 / ratioOf(s);
  const w = s.knee * KNEE_DB_PER_STEP;
  const over = inDb - t;
  let reduce = 0;
  if (w > 0 && Math.abs(over) <= w / 2) reduce = (slope * (over + w / 2) ** 2) / (2 * w);
  else if (over > 0) reduce = slope * over;
  return inDb - reduce + (s.gain - 40);
}

// ---- LFOs

export type TrType = (typeof TR_TYPES)[number];

// Fixed pseudo-random steps for RND, one per cycle.
const RND_STEPS = [0.6, -0.3, 0.9, -0.8, 0.2, -0.6, 0.4, -0.1];

export interface TrWave {
  type: number; // TYPE, an index into TR_TYPES
  shape: number; // SHAPE, 0–100: pushes the wave towards a square
}

function baseWave(at: { type: TrType; ph: number; cycle: number }): number {
  const { ph } = at;
  switch (at.type) {
    case "TRI":
      return ph < 0.5 ? 4 * ph - 1 : 3 - 4 * ph;
    case "UP SAW":
      return 2 * ph - 1;
    case "DN SAW":
      return 1 - 2 * ph;
    case "SQR":
      return ph < 0.5 ? 1 : -1;
    case "RND":
      return RND_STEPS[((at.cycle % RND_STEPS.length) + RND_STEPS.length) % RND_STEPS.length]!;
    default:
      return Math.sin(2 * Math.PI * ph);
  }
}

// One of the tremolo's waves at `phase` cycles, −1…1.
export function trWave(w: TrWave, phase: number): number {
  const cycle = Math.floor(phase);
  const v = baseWave({ type: TR_TYPES[w.type] ?? "SIN", ph: phase - cycle, cycle });
  const k = Math.min(Math.max(w.shape, 0), 100) / 100;
  if (k === 0) return v;
  return Math.tanh(v * (1 + k * 6)) / Math.tanh(1 + k * 6);
}

// ---- time

export interface LfoTiming {
  rate: number; // RATE, 0–100
  sync: number; // BPM SYNC, an index into BPM_DIVS; 0 = OFF
}

// A BPM SYNC division as a fraction of a bar: "1/4" → 0.25, "3/2" → 1.5, "OFF" → undefined.
export function bpmBars(t: Pick<LfoTiming, "sync">): number | undefined {
  const label = BPM_DIVS[t.sync];
  if (!label || label === "OFF") return undefined;
  const [a, b = "1"] = label.split("/");
  return Number(a) / Number(b);
}

// An LFO's period as a fraction of a bar at 120 BPM (2 s): from BPM SYNC when it's on, else from RATE
// (dispRate: 8000 ms … 20 ms).
export function lfoBars(t: LfoTiming): number {
  const bars = bpmBars(t);
  if (bars !== undefined) return bars;
  const ms = (1 - t.rate / 100) * 7980 + 20;
  return ms / 2000;
}

export interface Tap {
  at: number; // 0–1 across the window
  level: number; // 0–1
  side: -1 | 0 | 1; // −1 left, 1 right, 0 centre
}

export interface DelayDrawing {
  time: number; // between repeats, as a fraction of the window
  feedback: number; // FEEDBACK, 0–100
  mode: number; // SINGLE, PAN, STEREO
  tap?: number; // PAN's left tap, 0–1 of `time` (default 1)
}

// The repeats of a delay inside a window.
export function delayTaps(d: DelayDrawing): Tap[] {
  const taps: Tap[] = [];
  const fb = Math.min(Math.max(d.feedback, 0), 100) / 100;
  const step = Math.max(d.time, 0.02);
  const left = step * Math.min(Math.max(d.tap ?? 1, 0), 1);
  for (let k = 0, at = step; at <= 1 && k < 40; k++, at += step) {
    const level = fb ** k;
    if (level < 0.03) break;
    if (d.mode === 1) taps.push({ at: at - step + left, level, side: -1 }, { at, level: level * 0.9, side: 1 });
    else if (d.mode === 2) taps.push({ at, level, side: k % 2 === 0 ? -1 : 1 });
    else taps.push({ at, level, side: 0 });
  }
  return taps.filter((t) => t.at <= 1);
}

// ---- reverb

// The tail's level (0–1, linear) `t` seconds after the pre-delay, falling 60 dB over TIME (seconds).
export const tailLevel = (r: { time: number }, t: number) => (t < 0 ? 0 : Math.pow(10, (-3 * t) / Math.max(r.time, 0.05)));
