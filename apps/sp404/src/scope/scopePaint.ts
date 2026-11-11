// Painting the meter column and the SCOPE view each frame, from the scope state (docs/sp404-design.md › Scopes).
// Readouts are set as text on their elements, so React doesn't re-render 60 times a second.

import {
  correlationOf, drawCorrelation, drawMeter, drawWave, formatDb, formatLufs, integratedLufs, paletteOf,
  shortTermLufs, surfaceOf,
} from "@synth-editors/audio";
import type { Palette } from "@synth-editors/audio";
import { drawSpectrogram, drawSpectrum } from "./scopeDraw";
import type { ScopeState } from "./scopeEngine";

export type PartName =
  | "meter" | "peak" | "clip" | "lufsS" | "lufsI" | "spectrum" | "spectrogram" | "waveL" | "waveR" | "correlation"
  | "corrText" | "clock";
export type Parts = Partial<Record<PartName, HTMLElement | null>>;

const canvasOf = (parts: Parts, name: PartName) => parts[name] as HTMLCanvasElement | null | undefined;

function setText(el: HTMLElement | null | undefined, text: string) {
  if (el && el.textContent !== text) el.textContent = text;
}

function setTitle(el: HTMLElement | null | undefined, title: string) {
  if (el && el.title !== title) el.title = title;
}

function surface(canvas: HTMLCanvasElement, p: Palette) {
  return surfaceOf(canvas, { w: canvas.offsetWidth, h: canvas.offsetHeight }, p);
}

export function paintMeter(s: ScopeState, parts: Parts, p: Palette) {
  const meter = canvasOf(parts, "meter");
  if (!meter) return;
  drawMeter(surface(meter, p), s.meters);
  const [l, r] = s.meters;
  setText(parts.peak, formatDb(Math.max(l.maxDb, r.maxDb)).replace(" dB", ""));
  parts.clip?.classList.toggle("on", l.clipped || r.clipped);
  setText(parts.lufsS, s.loudness ? formatLufs(shortTermLufs(s.loudness)) : "–");
  setText(parts.lufsI, s.loudness ? formatLufs(integratedLufs(s.loudness)) : "–");
  meter.dataset.level = String(Math.max(l.db, r.db)); // for tests
}

function paintLanes(s: ScopeState, parts: Parts, p: Palette) {
  [canvasOf(parts, "waveL"), canvasOf(parts, "waveR")].forEach((canvas, i) => {
    if (canvas) drawWave(surface(canvas, p), s.waves?.lanes[i] ?? null);
  });
}

function paintSpectrum(s: ScopeState, canvas: HTMLCanvasElement, p: Palette) {
  drawSpectrum(surface(canvas, p), s.spectrum?.line ?? null, s.spectrum?.peaks ?? null);
  canvas.dataset.peak = String(s.spectrum ? Math.max(...s.spectrum.line) : -Infinity); // for tests
}

function clockText(bpm: number | undefined, inputName: string | undefined) {
  if (!inputName) return "NO CLOCK INPUT";
  return bpm ? `${bpm.toFixed(1)} BPM` : "NO CLOCK";
}

export interface ScopeFrame {
  bpm: number | undefined; // the steadied tempo
  clockInput: string | undefined;
}

export function paintScope(s: ScopeState, parts: Parts, p: Palette, f: ScopeFrame) {
  const spectrum = canvasOf(parts, "spectrum");
  const spectrogram = canvasOf(parts, "spectrogram");
  if (spectrum) paintSpectrum(s, spectrum, p);
  else if (spectrogram) drawSpectrogram(surface(spectrogram, p), s.spectrogram);
  else return;
  paintLanes(s, parts, p);
  const corr = s.correlation ? correlationOf(s.correlation) : NaN;
  const bar = canvasOf(parts, "correlation");
  if (bar) drawCorrelation(surface(bar, p), corr);
  setText(parts.corrText, Number.isNaN(corr) ? "–" : corr.toFixed(2).replace("-", "−"));
  setText(parts.clock, clockText(f.bpm, f.clockInput));
  setTitle(parts.clock, f.clockInput ? `MIDI clock from ${f.clockInput}` : "Choose a clock input in Settings");
}

let palette: Palette | null = null;
export const paletteFor = (el: Element) => (palette ??= paletteOf(el));
