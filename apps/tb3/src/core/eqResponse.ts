// EQ preview: magnitude response of the EFX1 EQ, for drawing. Approximate: the parametric mids
// use their real frequency, Q and gain, but the TB-3's shelf turnover frequencies and cut slopes
// are unknown, so the shelves are assumed at SHELF_HZ and the cuts are 12 dB/octave.
import { EQ_FREQS, EQ_Q, HPF_FREQS, LPF_FREQS } from "./display";

export interface EqSettings {
  lowCut: number; // raw bytes, as stored in the EFX block
  lowGain: number;
  lmFreq: number;
  lmQ: number;
  lmGain: number;
  hmFreq: number;
  hmQ: number;
  hmGain: number;
  hiCut: number;
  hiGain: number;
  level: number;
}

export const SHELF_HZ = { low: 100, high: 8000 } as const;
export const EQ_MIN_HZ = 15; // a little below 20 Hz, so the low cut's "Flat" sits apart from 20 Hz
export const EQ_MAX_HZ = 20000;
const GAIN_CENTRE = 20; // gains and level: raw 20 = 0 dB, 1 dB per step
const SHELF_Q = Math.SQRT1_2;

// "1.25 kHz" → 1250, "Flat" → null.
export function parseHz(label: string): number | null {
  const m = /^([\d.]+)\s*(k?)Hz$/.exec(label);
  return m ? Number(m[1]) * (m[2] ? 1000 : 1) : null;
}

const db = (raw: number) => raw - GAIN_CENTRE;

// |a·s² + b·s + c| at s = jw.
const quad = (a: number, b: number, c: number, w: number) => Math.hypot(c - a * w * w, b * w);

// Analog (RBJ cookbook) prototypes, w in units of the band's own frequency.
function peak(w: number, gain: number, q: number) {
  const A = 10 ** (gain / 40);
  return quad(1, A / q, 1, w) / quad(1, 1 / (A * q), 1, w);
}
function lowShelf(w: number, gain: number) {
  const A = 10 ** (gain / 40);
  const k = Math.sqrt(A) / SHELF_Q;
  return (A * quad(1, k, A, w)) / quad(A, k, 1, w);
}
function highShelf(w: number, gain: number) {
  const A = 10 ** (gain / 40);
  const k = Math.sqrt(A) / SHELF_Q;
  return (A * quad(A, k, 1, w)) / quad(1, k, A, w);
}
const highPass = (w: number) => w ** 2 / Math.sqrt(1 + w ** 4); // 2nd-order Butterworth
const lowPass = (w: number) => 1 / Math.sqrt(1 + w ** 4);

// Gain in dB at frequency `hz`.
export function eqGainDb(e: EqSettings, hz: number): number {
  let mag = lowShelf(hz / SHELF_HZ.low, db(e.lowGain)) * highShelf(hz / SHELF_HZ.high, db(e.hiGain));
  const lm = parseHz(EQ_FREQS[e.lmFreq] ?? "");
  const hm = parseHz(EQ_FREQS[e.hmFreq] ?? "");
  if (lm) mag *= peak(hz / lm, db(e.lmGain), Number(EQ_Q[e.lmQ] ?? 1));
  if (hm) mag *= peak(hz / hm, db(e.hmGain), Number(EQ_Q[e.hmQ] ?? 1));
  const hpf = parseHz(HPF_FREQS[e.lowCut] ?? "");
  const lpf = parseHz(LPF_FREQS[e.hiCut] ?? "");
  if (hpf) mag *= highPass(hz / hpf);
  if (lpf) mag *= lowPass(hz / lpf);
  return 20 * Math.log10(mag) + db(e.level);
}

// `n + 1` frequencies spaced evenly on a log axis from EQ_MIN_HZ to EQ_MAX_HZ.
export const eqFreqs = (n: number): number[] =>
  Array.from({ length: n + 1 }, (_, i) => EQ_MIN_HZ * (EQ_MAX_HZ / EQ_MIN_HZ) ** (i / n));

export const eqResponse = (e: EqSettings, n = 200): number[] => eqFreqs(n).map((hz) => eqGainDb(e, hz));
