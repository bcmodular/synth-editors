// A scrolling spectrogram (docs/sp404-design.md › Scopes): time left to right, frequency bottom to top on the
// spectrum's log axis, level as colour. Columns are added at a steady rate for the span shown (so beat lines can
// sit over it) rather than once per frame; each holds one level per row, 0 to 255, in a ring.

import { planSpectrum, spectrumColumns } from "./spectrumView";
import type { SpectrumPlan } from "./spectrumView";

export interface SpectrogramSize {
  width: number; // columns
  rows: number;
}

export interface Spectrogram {
  readonly width: number;
  readonly rows: number;
  readonly spanS: number;
  readonly plan: SpectrumPlan; // one "column" of the plan per row, row 0 the lowest frequency
  readonly bins: Float32Array; // the analyser's dB per bin
  readonly column: Float32Array; // the newest column's dB per row
  readonly levels: Uint8Array; // width × rows, column by column
  head: number; // the column written next (the oldest)
  owed: number; // columns due but not yet written, fractional
  now: number; // audio seconds at the newest column
}

// The dB range spread over the 256 levels.
export interface LevelRange {
  floorDb: number;
  topDb: number;
}

export function createSpectrogram(size: SpectrogramSize, fft: { rate: number; size: number; spanS: number }) {
  const sg: Spectrogram = {
    ...size,
    spanS: fft.spanS,
    plan: planSpectrum(size.rows, fft.rate, fft.size),
    bins: new Float32Array(fft.size / 2),
    column: new Float32Array(size.rows),
    levels: new Uint8Array(size.width * size.rows),
    head: 0,
    owed: 0,
    now: 0,
  };
  return sg;
}

export const levelOf = (db: number, { floorDb, topDb }: LevelRange) =>
  Number.isFinite(db) ? Math.round(255 * Math.min(1, Math.max(0, (db - floorDb) / (topDb - floorDb)))) : 0;

// Turn the analyser's bins (already read into `sg.bins`) into the columns due by audio time `now`.
export function spectrogramStep(sg: Spectrogram, now: number, range: LevelRange) {
  const seconds = sg.now ? Math.max(0, now - sg.now) : 0;
  sg.now = now;
  sg.owed = Math.min(sg.width, sg.owed + (seconds * sg.width) / sg.spanS);
  const due = Math.floor(sg.owed);
  if (due === 0) return;
  sg.owed -= due;
  spectrumColumns(sg.plan, sg.bins, sg.column);
  const rows = sg.rows;
  for (let n = 0; n < due; n++) {
    const at = sg.head * rows;
    for (let y = 0; y < rows; y++) sg.levels[at + y] = levelOf(sg.column[y]!, range);
    sg.head = (sg.head + 1) % sg.width;
  }
}

// The level at screen column x (0 = oldest, on the left) and row y (0 = lowest frequency).
export const levelAt = (sg: Spectrogram, x: number, y: number) =>
  sg.levels[((sg.head + x) % sg.width) * sg.rows + y]!;

// The screen column of an audio time, newest on the right, or undefined when it's off the spectrogram.
export function spectrogramX(sg: Spectrogram, time: number): number | undefined {
  const x = sg.width - 1 - ((sg.now - time) * sg.width) / sg.spanS;
  return x >= 0 && x < sg.width ? x : undefined;
}

// Magma (from matplotlib, sampled at nine stops), dark for quiet to pale yellow for loud.
const MAGMA: readonly (readonly [number, number, number])[] = [
  [0, 0, 4], [28, 16, 68], [79, 18, 123], [129, 37, 129], [181, 54, 122],
  [229, 80, 100], [251, 135, 97], [254, 194, 135], [252, 253, 191],
];

// RGBA for each of the 256 levels.
export function magmaColours(): Uint8ClampedArray {
  const out = new Uint8ClampedArray(256 * 4);
  const last = MAGMA.length - 1;
  for (let level = 0; level < 256; level++) {
    const at = (level / 255) * last;
    const i = Math.min(last - 1, Math.floor(at));
    const t = at - i;
    for (let c = 0; c < 3; c++) out[level * 4 + c] = MAGMA[i]![c]! + (MAGMA[i + 1]![c]! - MAGMA[i]![c]!) * t;
    out[level * 4 + 3] = 255;
  }
  return out;
}

// The spectrogram as RGBA pixels, `width` × `rows`, the highest frequency on the top row.
export function spectrogramPixels(sg: Spectrogram, colours: Uint8ClampedArray, into: Uint8ClampedArray) {
  for (let x = 0; x < sg.width; x++) {
    const from = ((sg.head + x) % sg.width) * sg.rows;
    for (let y = 0; y < sg.rows; y++) {
      const c = sg.levels[from + y]! * 4;
      const p = ((sg.rows - 1 - y) * sg.width + x) * 4;
      into[p] = colours[c]!;
      into[p + 1] = colours[c + 1]!;
      into[p + 2] = colours[c + 2]!;
      into[p + 3] = 255;
    }
  }
}
