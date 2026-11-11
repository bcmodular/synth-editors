// What VCO MIX's LIVE view shows, advanced once per animation frame from the TB-3's USB audio
// (docs/tb3-live-waveform-design.md): the meters and correlation always, the L and R waveforms always (so switching
// back to them shows the last few seconds), and the spectrum or spectrogram only while shown.
import {
  clearClip, createCorrelation, createSpectrogram, createWaveColumns, meterStep, pushCorrelation, pushSamples,
  samplesPerColumn, silentMeter, spectrogramStep, spectrumTraceFor, stepSpectrumTrace,
} from "@synth-editors/audio";
import type { Correlation, Listening, Meter, Spectrogram, SpectrumTrace, WaveColumns } from "@synth-editors/audio";

export type LiveGraph = "wave" | "spectrum" | "spectrogram";

export const LIVE_SPAN_S = 4;
const SPECTRUM_FFT = 8192; // ≈ 12 Hz per bin at 96 kHz, ≈ 5 Hz at 44.1 kHz
const SPECTROGRAM_FFT = 2048; // short enough that each step of a pattern stays sharp
const SPECTROGRAM_RANGE = { floorDb: -100, topDb: -30 };
export const LISTEN_OPTIONS = { spectrumSize: SPECTRUM_FFT, spectrumSmoothing: 0.6, spectrogramSize: SPECTROGRAM_FFT };

type Pair<T> = [T, T];

export interface LiveState {
  rate: number;
  waves: Pair<WaveColumns> | null;
  corr: Correlation | null;
  meters: Pair<Meter>;
  spectrum: SpectrumTrace | null;
  spectrogram: Spectrogram | null;
}

export const emptyLive = (): LiveState => ({
  rate: 0, waves: null, corr: null, meters: [silentMeter(), silentMeter()], spectrum: null, spectrogram: null,
});

// The graph shown and its size in CSS px; the waveform lanes' width.
export interface LiveLayout {
  graph: LiveGraph;
  waveW: number;
  w: number;
  h: number;
}

function restart(s: LiveState, rate: number, waveW: number) {
  const perColumn = samplesPerColumn(LIVE_SPAN_S, waveW, rate);
  s.rate = rate;
  s.waves = [createWaveColumns(waveW, perColumn), createWaveColumns(waveW, perColumn)];
  s.corr = createCorrelation(rate);
  s.spectrum = null;
  s.spectrogram = null;
}

function advanceSpectrum(s: LiveState, l: Listening, { w }: LiveLayout, now: number) {
  if (!l.spectrum) return;
  const t = (s.spectrum = spectrumTraceFor(s.spectrum, w, { rate: s.rate, size: SPECTRUM_FFT }));
  stepSpectrumTrace(t, l.spectrum, now);
}

const fitsSpectrogram = (sg: Spectrogram | null, { w, h }: LiveLayout) => sg?.width === w && sg.rows === h;

function advanceSpectrogram(s: LiveState, l: Listening, layout: LiveLayout, now: number) {
  if (!l.spectrogram) return;
  if (!fitsSpectrogram(s.spectrogram, layout)) {
    const fft = { rate: s.rate, size: SPECTROGRAM_FFT, spanS: LIVE_SPAN_S };
    s.spectrogram = createSpectrogram({ width: layout.w, rows: layout.h }, fft);
  }
  const sg = s.spectrogram!;
  l.spectrogram(sg.bins);
  spectrogramStep(sg, now, SPECTROGRAM_RANGE);
}

// Read the audio that arrived since the last frame and update what the view shows.
export function advanceLive(s: LiveState, l: Listening, layout: LiveLayout) {
  if (s.rate !== l.sampleRate || s.waves?.[0].width !== layout.waveW) restart(s, l.sampleRate, layout.waveW);
  const f = l.read();
  pushSamples(s.waves![0], f.left);
  pushSamples(s.waves![1], f.right);
  pushCorrelation(s.corr!, f.left, f.right);
  s.meters = [meterStep(s.meters[0], f.left, f.now), meterStep(s.meters[1], f.right, f.now)];
  if (layout.graph === "spectrum") advanceSpectrum(s, l, layout, f.now);
  if (layout.graph === "spectrogram") advanceSpectrogram(s, l, layout, f.now);
}

export function clearClips(s: LiveState) {
  s.meters = [clearClip(s.meters[0]), clearClip(s.meters[1])];
}
