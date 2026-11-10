// The spectrum as a smoothed line on a log frequency axis (docs/sp404-design.md › Scopes): from the analyser's dB
// per FFT bin to one value per screen column, each the mean power of a 1/6-octave band around the column's
// frequency, tilted 4.5 dB per octave about 1 kHz so a typical mix reads roughly flat. A peak line falls slowly.

export const SPECTRUM_LOW_HZ = 20;
export const SPECTRUM_HIGH_HZ = 20000;
const BAND_OCTAVES = 1 / 6;
export const TILT_DB_PER_OCTAVE = 4.5;
const TILT_PIVOT_HZ = 1000;
export const PEAK_FALL_DB_PER_S = 12;

// For each column: the FFT bins to average (from, to inclusive) and the tilt to add.
export interface SpectrumPlan {
  readonly columns: number;
  readonly from: Uint32Array;
  readonly to: Uint32Array;
  readonly tilt: Float32Array;
}

// The frequency at a column, 0 to columns − 1, left to right.
export const columnHz = (x: number, columns: number) =>
  SPECTRUM_LOW_HZ * (SPECTRUM_HIGH_HZ / SPECTRUM_LOW_HZ) ** (x / Math.max(1, columns - 1));

// Where a frequency falls across `columns`, as a fraction 0 to 1 (for axis labels).
export const hzFraction = (hz: number) =>
  Math.log(hz / SPECTRUM_LOW_HZ) / Math.log(SPECTRUM_HIGH_HZ / SPECTRUM_LOW_HZ);

export function planSpectrum(columns: number, rate: number, fftSize: number): SpectrumPlan {
  const binHz = rate / fftSize;
  const lastBin = fftSize / 2 - 1;
  const plan = {
    columns,
    from: new Uint32Array(columns),
    to: new Uint32Array(columns),
    tilt: new Float32Array(columns),
  };
  for (let x = 0; x < columns; x++) {
    const hz = columnHz(x, columns);
    const half = 2 ** (BAND_OCTAVES / 2);
    const lo = Math.min(lastBin, Math.max(1, Math.floor(hz / half / binHz)));
    plan.from[x] = lo;
    plan.to[x] = Math.min(lastBin, Math.max(lo, Math.ceil((hz * half) / binHz)));
    plan.tilt[x] = TILT_DB_PER_OCTAVE * Math.log2(hz / TILT_PIVOT_HZ);
  }
  return plan;
}

const powerOf = (db: number) => (Number.isFinite(db) ? 10 ** (db / 10) : 0);

// One smoothed, tilted dB value per column into `out`, from the analyser's dB per bin.
export function spectrumColumns(plan: SpectrumPlan, binsDb: ArrayLike<number>, out: Float32Array) {
  for (let x = 0; x < plan.columns; x++) {
    let sum = 0;
    for (let b = plan.from[x]!; b <= plan.to[x]!; b++) sum += powerOf(binsDb[b]!);
    const mean = sum / (plan.to[x]! - plan.from[x]! + 1);
    out[x] = (mean > 0 ? 10 * Math.log10(mean) : -Infinity) + plan.tilt[x]!;
  }
}

// The peak line: up at once to a new value, else down at PEAK_FALL_DB_PER_S.
export function fallPeaks(peaks: Float32Array, now: ArrayLike<number>, seconds: number) {
  const fall = PEAK_FALL_DB_PER_S * seconds;
  for (let x = 0; x < peaks.length; x++) {
    const p = Number.isFinite(peaks[x]!) ? peaks[x]! - fall : -Infinity;
    peaks[x] = Math.max(p, now[x]!);
  }
}
