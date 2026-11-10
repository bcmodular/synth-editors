// Painting the meter column and the SCOPE view each frame, from the scope state (docs/sp404-design.md › Scopes).
// Readouts are set as text on their elements, so React doesn't re-render 60 times a second.

import {
  clockBpm, correlationOf, drawCorrelation, drawMeter, drawWave, formatDb, formatLufs, integratedLufs, paletteOf,
  shortTermLufs, surfaceOf,
} from "@synth-editors/audio";
import type { BeatClock, Listening, Palette } from "@synth-editors/audio";
import { drawBeats, drawSpectrum } from "./scopeDraw";
import { columnOfTime, type ScopeState, type Waves } from "./scopeEngine";

export type PartName =
  | "meter" | "peak" | "clip" | "lufsS" | "lufsI" | "spectrum" | "waveL" | "waveR" | "correlation" | "corrText" | "clock";
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

// The beats on screen for a lane, by column.
function beatsOn(w: Waves, clock: BeatClock, l: Listening) {
  return clock.beats.flatMap((beat) => {
    const x = columnOfTime(w, l.audioTimeOf(beat.at));
    return x === undefined ? [] : [{ beat, x }];
  });
}

function paintLanes(s: ScopeState, parts: Parts, ctx: { p: Palette; clock: BeatClock; l: Listening | null }) {
  const lanes = [canvasOf(parts, "waveL"), canvasOf(parts, "waveR")];
  const beats = s.waves && ctx.l ? beatsOn(s.waves, ctx.clock, ctx.l) : [];
  lanes.forEach((canvas, i) => {
    if (!canvas) return;
    const surf = surface(canvas, ctx.p);
    drawWave(surf, s.waves?.lanes[i] ?? null);
    drawBeats(surf, beats, i === 0 && ctx.clock.fromStart);
    canvas.dataset.beats = String(beats.length); // for tests
  });
}

function clockText(clock: BeatClock, inputName: string | undefined) {
  const bpm = clockBpm(clock, performance.now());
  if (!inputName) return "NO CLOCK INPUT";
  return bpm ? `${bpm.toFixed(1)} BPM · ${inputName}` : `NO CLOCK · ${inputName}`;
}

export interface ScopeFrame {
  clock: BeatClock;
  clockInput: string | undefined;
  listening: Listening | null;
}

export function paintScope(s: ScopeState, parts: Parts, p: Palette, f: ScopeFrame) {
  const spectrum = canvasOf(parts, "spectrum");
  if (!spectrum) return;
  drawSpectrum(surface(spectrum, p), s.spectrum?.line ?? null, s.spectrum?.peaks ?? null);
  spectrum.dataset.peak = String(s.spectrum ? Math.max(...s.spectrum.line) : -Infinity); // for tests
  paintLanes(s, parts, { p, clock: f.clock, l: f.listening });
  const corr = s.correlation ? correlationOf(s.correlation) : NaN;
  const bar = canvasOf(parts, "correlation");
  if (bar) drawCorrelation(surface(bar, p), corr);
  setText(parts.corrText, Number.isNaN(corr) ? "–" : corr.toFixed(2).replace("-", "−"));
  setText(parts.clock, clockText(f.clock, f.clockInput));
}

let palette: Palette | null = null;
export const paletteFor = (el: Element) => (palette ??= paletteOf(el));
