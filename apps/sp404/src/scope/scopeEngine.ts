// What the scopes show, advanced once per animation frame from the SP-404's USB audio (docs/sp404-design.md ›
// Scopes): the meter, loudness and correlation always; the L and R waveforms and the spectrum or spectrogram unless
// HOLD is on.
// Kept outside React: a frame's work is reading samples and updating arrays in place.

import {
  clearClip, createCorrelation, createLoudness, createSpectrogram, createWaveColumns, fallPeaks, meterStep,
  planSpectrum, pushCorrelation, pushLoudness, pushSamples, resetIntegrated, samplesPerColumn, silentMeter,
  spectrogramStep, spectrumColumns,
} from "@synth-editors/audio";
import type {
  Correlation, Listening, Loudness, Meter, Spectrogram, SpectrogramSize, SpectrumPlan, WaveColumns,
} from "@synth-editors/audio";

export const SPECTRUM_FFT = 8192; // ≈ 5.9 Hz per bin at 48 kHz, so 20 Hz is resolved
export const SPECTROGRAM_FFT = 2048; // ≈ 43 ms at 48 kHz: drum hits stay sharp, at the cost of the lowest notes
const SPECTROGRAM_RANGE = { floorDb: -100, topDb: -30 };
const SPECTRUM_EVERY_S = 1 / 30;
export const FREE_SPAN_S = 4;
const RESPAN_TOLERANCE = 0.02; // rebuild the waveform when the bar span moves by more than this

// The waveform span: 4 seconds, or a number of bars at the clock's tempo.
export type Span = "4s" | 1 | 2 | 4;
export const SPANS: readonly Span[] = ["4s", 1, 2, 4];

export interface Waves {
  lanes: [WaveColumns, WaveColumns];
  rate: number;
  spanS: number;
  now: number; // audio seconds at the newest column
}

export interface Spectrum {
  plan: SpectrumPlan;
  bins: Float32Array;
  line: Float32Array;
  peaks: Float32Array;
  at: number;
}

export interface ScopeState {
  rate: number;
  meters: [Meter, Meter];
  loudness: Loudness | null;
  correlation: Correlation | null;
  waves: Waves | null;
  spectrum: Spectrum | null;
  spectrogram: Spectrogram | null;
  held: boolean;
}

export const emptyScope = (): ScopeState => ({
  rate: 0, meters: [silentMeter(), silentMeter()], loudness: null, correlation: null, waves: null, spectrum: null,
  spectrogram: null, held: false,
});

// What the visible scope view asks for this frame: its sizes (0 = hidden), the span and the clock's tempo.
export interface ScopeLayout {
  waveWidth: number;
  spectrumWidth: number;
  spectrogram: SpectrogramSize;
  span: Span;
  bpm: number | undefined;
}

// The span in seconds: bars at the clock's tempo (four beats a bar), else 4 s.
export function spanSeconds(span: Span, bpm: number | undefined): number {
  return span === "4s" || !bpm ? FREE_SPAN_S : (span * 4 * 60) / bpm;
}

function restart(s: ScopeState, l: Listening) {
  s.rate = l.sampleRate;
  s.loudness = createLoudness(s.rate);
  s.correlation = createCorrelation(s.rate);
  s.waves = null;
  s.spectrum = null;
  s.spectrogram = null;
}

interface WaveSize {
  width: number;
  spanS: number;
}

const sameSpan = (was: number, spanS: number) => Math.abs(was - spanS) <= was * RESPAN_TOLERANCE;
const fits = (w: Waves, { width, spanS }: WaveSize) => w.lanes[0].width === width && sameSpan(w.spanS, spanS);

function wavesFor(s: ScopeState, size: WaveSize): Waves {
  if (s.waves && fits(s.waves, size)) return s.waves;
  const per = samplesPerColumn(size.spanS, size.width, s.rate);
  const lanes: Waves["lanes"] = [createWaveColumns(size.width, per), createWaveColumns(size.width, per)];
  return { lanes, rate: s.rate, spanS: size.spanS, now: 0 };
}

function spectrumFor(s: ScopeState, width: number): Spectrum {
  if (s.spectrum?.plan.columns === width) return s.spectrum;
  const line = new Float32Array(width).fill(-Infinity);
  const bins = new Float32Array(SPECTRUM_FFT / 2);
  return { plan: planSpectrum(width, s.rate, SPECTRUM_FFT), bins, line, peaks: line.slice(), at: 0 };
}

function advanceSpectrum(s: ScopeState, l: Listening, { width, now }: { width: number; now: number }) {
  if (!l.spectrum) return;
  const sp = (s.spectrum = spectrumFor(s, width));
  if (now - sp.at < SPECTRUM_EVERY_S) return;
  l.spectrum(sp.bins);
  spectrumColumns(sp.plan, sp.bins, sp.line);
  fallPeaks(sp.peaks, sp.line, sp.at ? now - sp.at : 0);
  sp.at = now;
}

const spectrogramFits = (sg: Spectrogram, size: SpectrogramSize, spanS: number) =>
  sg.width === size.width && sg.rows === size.rows && sameSpan(sg.spanS, spanS);

function spectrogramFor(s: ScopeState, size: SpectrogramSize, spanS: number): Spectrogram {
  if (s.spectrogram && spectrogramFits(s.spectrogram, size, spanS)) return s.spectrogram;
  return createSpectrogram(size, { rate: s.rate, size: SPECTROGRAM_FFT, spanS });
}

interface Moment {
  spanS: number;
  now: number;
}

function advanceSpectrogram(s: ScopeState, l: Listening, size: SpectrogramSize, { spanS, now }: Moment) {
  if (!l.spectrogram) return;
  const sg = (s.spectrogram = spectrogramFor(s, size, spanS));
  l.spectrogram(sg.bins);
  spectrogramStep(sg, now, SPECTROGRAM_RANGE);
}

// Read the audio that arrived and update everything the frame shows.
export function advanceScope(s: ScopeState, l: Listening, layout: ScopeLayout) {
  if (s.rate !== l.sampleRate) restart(s, l);
  const f = l.read();
  s.meters = [meterStep(s.meters[0], f.left, f.now), meterStep(s.meters[1], f.right, f.now)];
  pushLoudness(s.loudness!, f.left, f.right);
  pushCorrelation(s.correlation!, f.left, f.right);
  if (s.held) return;
  const spanS = spanSeconds(layout.span, layout.bpm);
  if (layout.waveWidth > 0) {
    const w = (s.waves = wavesFor(s, { width: layout.waveWidth, spanS }));
    pushSamples(w.lanes[0], f.left);
    pushSamples(w.lanes[1], f.right);
    w.now = f.now;
  }
  if (layout.spectrumWidth > 0) advanceSpectrum(s, l, { width: layout.spectrumWidth, now: f.now });
  if (layout.spectrogram.width > 0) advanceSpectrogram(s, l, layout.spectrogram, { spanS, now: f.now });
}

export function clearPeaks(s: ScopeState) {
  s.meters = [clearClip(s.meters[0]), clearClip(s.meters[1])];
}

export function resetLoudness(s: ScopeState) {
  if (s.loudness) resetIntegrated(s.loudness);
}

// HOLD freezes the waveform, spectrum and spectrogram; letting go starts the waveform and spectrogram afresh, so
// their columns stay in step with the clock.
export function setHeld(s: ScopeState, held: boolean) {
  if (s.held && !held) {
    s.waves = null;
    s.spectrogram = null;
  }
  s.held = held;
}

// The screen column of an audio time on a waveform lane, or undefined when it's off the lane.
export function columnOfTime(w: Waves, time: number): number | undefined {
  const lane = w.lanes[0];
  const x = lane.width - 1 - ((w.now - time) * w.rate) / lane.perColumn;
  return x >= 0 && x < lane.width ? x : undefined;
}
