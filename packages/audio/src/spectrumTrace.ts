// The spectrum scope's moving parts (docs/sp404-design.md › Scopes): the smoothed line and its falling peak line,
// redone from the analyser at most SPECTRUM_EVERY_S apart.
import { fallPeaks, planSpectrum, spectrumColumns } from "./spectrumView";
import type { SpectrumPlan } from "./spectrumView";

export const SPECTRUM_EVERY_S = 1 / 30;

export interface SpectrumTrace {
  readonly plan: SpectrumPlan;
  readonly fftSize: number;
  readonly bins: Float32Array; // the analyser's dB per bin
  readonly line: Float32Array; // dB per column
  readonly peaks: Float32Array;
  at: number; // audio seconds at the last update, 0 before the first
}

export function createSpectrumTrace(width: number, fft: { rate: number; size: number }): SpectrumTrace {
  const line = new Float32Array(width).fill(-Infinity);
  return { plan: planSpectrum(width, fft.rate, fft.size), fftSize: fft.size, bins: new Float32Array(fft.size / 2),
    line, peaks: line.slice(), at: 0 };
}

// The trace for `width` columns: `was` if it still fits, else a new one.
export const spectrumTraceFor = (was: SpectrumTrace | null, width: number, fft: { rate: number; size: number }) =>
  was?.plan.columns === width && was.fftSize === fft.size ? was : createSpectrumTrace(width, fft);

// Read the analyser into the trace (`read` fills the bins) if it's time, at audio time `now`.
export function stepSpectrumTrace(t: SpectrumTrace, read: (into: Float32Array) => void, now: number) {
  if (t.at && now - t.at < SPECTRUM_EVERY_S) return;
  read(t.bins);
  spectrumColumns(t.plan, t.bins, t.line);
  fallPeaks(t.peaks, t.line, t.at ? now - t.at : 0);
  t.at = now;
}
