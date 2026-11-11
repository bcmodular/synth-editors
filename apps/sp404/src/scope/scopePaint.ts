// Painting the meter column and the SCOPE view each frame, from the scope state (docs/sp404-design.md › Scopes).
// Readouts are set as text on their elements, so React doesn't re-render 60 times a second.

import {
  correlationOf, drawCorrelation, drawMeter, drawWave, formatDb, formatLufs, integratedLufs, paletteOf,
  shortTermLufs, spectrogramX, surfaceOf,
} from "@synth-editors/audio";
import type { BeatClock, Listening, Palette } from "@synth-editors/audio";
import { drawBeats, drawSpectrogram, drawSpectrum } from "./scopeDraw";
import { columnOfTime, type ScopeState } from "./scopeEngine";

export type PartName =
  | "meter" | "peak" | "clip" | "lufsS" | "lufsI" | "spectrum" | "spectrogram" | "waveL" | "waveR" | "correlation"
  | "corrText" | "clock";
export type Parts = Partial<Record<PartName, HTMLElement | null>>;

const canvasOf = (parts: Parts, name: PartName) => parts[name] as HTMLCanvasElement | null | undefined;

function setText(el: HTMLElement | null | undefined, text: string) {
  if (el && el.textContent !== text) el.textContent = text;
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

type ColumnOf = (audioTime: number) => number | undefined;

// The beats on screen, by column, for a view that places audio times with `columnOf`.
function beatsOn(columnOf: ColumnOf, clock: BeatClock, l: Listening) {
  return clock.beats.flatMap((beat) => {
    const x = columnOf(l.audioTimeOf(beat.at));
    return x === undefined ? [] : [{ beat, x }];
  });
}

interface PaintContext {
  p: Palette;
  clock: BeatClock;
  l: Listening | null;
}

function paintLanes(s: ScopeState, parts: Parts, ctx: PaintContext) {
  const lanes = [canvasOf(parts, "waveL"), canvasOf(parts, "waveR")];
  const w = s.waves;
  const beats = w && ctx.l ? beatsOn((t) => columnOfTime(w, t), ctx.clock, ctx.l) : [];
  lanes.forEach((canvas, i) => {
    if (!canvas) return;
    const surf = surface(canvas, ctx.p);
    drawWave(surf, s.waves?.lanes[i] ?? null);
    drawBeats(surf, beats, i === 0 && ctx.clock.fromStart);
    canvas.dataset.beats = String(beats.length); // for tests
  });
}

function paintSpectrogram(s: ScopeState, canvas: HTMLCanvasElement, ctx: PaintContext) {
  const surf = surface(canvas, ctx.p);
  const sg = s.spectrogram;
  drawSpectrogram(surf, sg);
  if (sg && ctx.l) drawBeats(surf, beatsOn((t) => spectrogramX(sg, t), ctx.clock, ctx.l), true);
}

function paintSpectrum(s: ScopeState, canvas: HTMLCanvasElement, p: Palette) {
  drawSpectrum(surface(canvas, p), s.spectrum?.line ?? null, s.spectrum?.peaks ?? null);
  canvas.dataset.peak = String(s.spectrum ? Math.max(...s.spectrum.line) : -Infinity); // for tests
}

function clockText(bpm: number | undefined, inputName: string | undefined) {
  if (!inputName) return "NO CLOCK INPUT";
  return bpm ? `${bpm.toFixed(1)} BPM · ${inputName}` : `NO CLOCK · ${inputName}`;
}

export interface ScopeFrame {
  clock: BeatClock;
  bpm: number | undefined; // the steadied tempo
  clockInput: string | undefined;
  listening: Listening | null;
}

export function paintScope(s: ScopeState, parts: Parts, p: Palette, f: ScopeFrame) {
  const ctx = { p, clock: f.clock, l: f.listening };
  const spectrum = canvasOf(parts, "spectrum");
  const spectrogram = canvasOf(parts, "spectrogram");
  if (spectrum) paintSpectrum(s, spectrum, p);
  else if (spectrogram) paintSpectrogram(s, spectrogram, ctx);
  else return;
  paintLanes(s, parts, ctx);
  const corr = s.correlation ? correlationOf(s.correlation) : NaN;
  const bar = canvasOf(parts, "correlation");
  if (bar) drawCorrelation(surface(bar, p), corr);
  setText(parts.corrText, Number.isNaN(corr) ? "–" : corr.toFixed(2).replace("-", "−"));
  setText(parts.clock, clockText(f.bpm, f.clockInput));
}

let palette: Palette | null = null;
export const paletteFor = (el: Element) => (palette ??= paletteOf(el));
