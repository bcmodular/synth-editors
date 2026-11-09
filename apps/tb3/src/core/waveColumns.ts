// A scrolling waveform as columns: each column holds the lowest and highest sample of its slice of
// time, so a few seconds of audio fit across a few hundred pixels (docs/tb3-live-waveform-design.md).
// The ring is updated in place each animation frame, so drawing doesn't allocate.

export interface WaveColumns {
  readonly width: number;
  readonly perColumn: number; // samples per column
  readonly mins: Float32Array;
  readonly maxs: Float32Array;
  head: number; // the next column to fill, which is also the oldest
  min: number; // the column being built
  max: number;
  count: number;
}

export function createWaveColumns(width: number, perColumn: number): WaveColumns {
  return {
    width,
    perColumn: Math.max(1, Math.round(perColumn)),
    mins: new Float32Array(width),
    maxs: new Float32Array(width),
    head: 0,
    min: Infinity,
    max: -Infinity,
    count: 0,
  };
}

function closeColumn(w: WaveColumns) {
  w.mins[w.head] = w.min;
  w.maxs[w.head] = w.max;
  w.head = (w.head + 1) % w.width;
  w.min = Infinity;
  w.max = -Infinity;
  w.count = 0;
}

// Add samples (−1..1) in the order they were played.
export function pushSamples(w: WaveColumns, samples: ArrayLike<number>) {
  for (let i = 0; i < samples.length; i++) {
    const s = samples[i]!;
    if (s < w.min) w.min = s;
    if (s > w.max) w.max = s;
    if (++w.count === w.perColumn) closeColumn(w);
  }
}

// Columns from oldest (left) to newest (right): calls `draw` with the screen column and its range.
export function forEachColumn(w: WaveColumns, draw: (x: number, min: number, max: number) => void) {
  for (let x = 0; x < w.width; x++) {
    const i = (w.head + x) % w.width;
    draw(x, w.mins[i]!, w.maxs[i]!);
  }
}

// Samples per column for `seconds` across `width` columns.
export const samplesPerColumn = (seconds: number, width: number, sampleRate: number) =>
  (seconds * sampleRate) / width;
