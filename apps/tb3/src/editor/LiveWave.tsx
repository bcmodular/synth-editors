// VCO MIX's LIVE view: the TB-3's output as scrolling L and R waveforms, a spectrum or a spectrogram, with a stereo
// correlation bar and a level meter (docs/tb3-live-waveform-design.md). Drawn each animation frame, outside React's
// renders; liveEngine.ts holds what's shown.
import { useEffect, useRef } from "react";
import type { RefObject } from "react";
import {
  correlationOf, drawCorrelation, drawMeter, drawSpectrogram, drawSpectrum, drawWave, formatDb, paletteOf, surfaceOf,
} from "@synth-editors/audio";
import type { Palette, Surface } from "@synth-editors/audio";
import { advanceLive, clearClips, emptyLive } from "./liveEngine";
import type { LiveGraph, LiveLayout, LiveState } from "./liveEngine";
import type { AudioStatus, Tb3Audio } from "./useTb3Audio";

const METER_W = 30;
const READOUT_H = 34;
const CORR_H = 10;
const GAP = 3;
const CLIP_TIP = "Clip light and highest peak (dBFS) since the last click: click to clear";
const CORR_TIP = "Stereo correlation: right of centre is alike in both sides (+1 is mono), left is out of phase";

type Canvas = RefObject<HTMLCanvasElement | null>;

interface Parts {
  box: RefObject<HTMLDivElement | null>;
  left: Canvas;
  right: Canvas;
  graph: Canvas;
  corr: Canvas;
  meter: Canvas;
  readout: RefObject<HTMLSpanElement | null>;
  clip: RefObject<HTMLButtonElement | null>;
}

interface Shown {
  live: LiveState;
  palette: Palette | null;
}

const surface = (c: Canvas, size: { w: number; h: number }, p: Palette): Surface | null =>
  c.current ? surfaceOf(c.current, size, p) : null;
const correlation = (s: LiveState) => (s.corr ? correlationOf(s.corr) : NaN);
const spectrumPeak = (s: LiveState) => (s.spectrum ? Math.max(...s.spectrum.line) : -Infinity);

type Size = { w: number; h: number };

function paintLanes(s: LiveState, parts: Parts, size: Size, p: Palette) {
  const lane = { w: size.w, h: (size.h - GAP) / 2 };
  const sides = [parts.left, parts.right] as const;
  sides.forEach((c, i) => {
    const g = surface(c, lane, p);
    if (g) drawWave(g, s.waves?.[i] ?? null);
  });
}

const PAINT_ONE: Record<Exclude<LiveGraph, "wave">, (g: Surface, s: LiveState) => void> = {
  spectrum: (g, s) => drawSpectrum(g, s.spectrum?.line ?? null, s.spectrum?.peaks ?? null),
  spectrogram: (g, s) => drawSpectrogram(g, s.spectrogram),
};

function paintGraph(s: LiveState, parts: Parts, layout: LiveLayout, p: Palette) {
  if (layout.graph === "wave") return paintLanes(s, parts, layout, p);
  const g = surface(parts.graph, layout, p);
  if (g) PAINT_ONE[layout.graph](g, s);
}

function paintReadouts(s: LiveState, parts: Parts) {
  const [l, r] = s.meters;
  parts.readout.current!.textContent = formatDb(Math.max(l.maxDb, r.maxDb)).replace(" dB", "");
  parts.clip.current!.classList.toggle("on", l.clipped || r.clipped);
  const data = parts.box.current!.dataset; // for tests
  data.level = String(Math.max(l.db, r.db));
  data.correlation = String(correlation(s));
  data.spectrum = String(spectrumPeak(s));
}

function paint(shown: Shown, parts: Parts, layout: LiveLayout & { fullH: number }) {
  const corr = parts.corr.current;
  if (!corr || !parts.meter.current) return;
  const p = (shown.palette ??= paletteOf(corr));
  const s = shown.live;
  paintGraph(s, parts, layout, p);
  drawCorrelation(surfaceOf(corr, { w: layout.w, h: CORR_H }, p), correlation(s));
  drawMeter(surfaceOf(parts.meter.current, { w: METER_W, h: layout.fullH - READOUT_H }, p), s.meters);
  paintReadouts(s, parts);
}

function useFrames(fn: () => void) {
  const latest = useRef(fn);
  latest.current = fn;
  useEffect(() => {
    let id = 0;
    const tick = () => {
      latest.current();
      id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, []);
}

const STATUS_TEXT: Record<AudioStatus["kind"], string> = { off: "", starting: "Opening audio input…", on: "", error: "" };
const statusText = (s: AudioStatus) => (s.kind === "error" ? s.message : STATUS_TEXT[s.kind]);

function Lane(p: { side: "L" | "R"; canvas: Canvas; w: number; h: number }) {
  return (
    <div className="lane">
      <canvas ref={p.canvas} style={{ width: p.w, height: p.h }} />
      <span className="lanelabel">{p.side}</span>
    </div>
  );
}

const GRAPH_LABEL: Record<Exclude<LiveGraph, "wave">, string> = { spectrum: "Spectrum", spectrogram: "Spectrogram" };

function Graph(p: { graph: LiveGraph; parts: Parts; w: number; h: number }) {
  if (p.graph === "wave") {
    const laneH = (p.h - GAP) / 2;
    return (
      <>
        <Lane side="L" canvas={p.parts.left} w={p.w} h={laneH} />
        <Lane side="R" canvas={p.parts.right} w={p.w} h={laneH} />
      </>
    );
  }
  const label = GRAPH_LABEL[p.graph];
  return <canvas key={p.graph} ref={p.parts.graph} aria-label={label} style={{ width: p.w, height: p.h }} />;
}

function useParts(): Parts {
  return { box: useRef(null), left: useRef(null), right: useRef(null), graph: useRef(null), corr: useRef(null),
    meter: useRef(null), readout: useRef(null), clip: useRef(null) };
}

export function LiveWave(p: { audio: Tb3Audio; width: number; height: number }) {
  const parts = useParts();
  const shown = useRef<Shown>({ live: emptyLive(), palette: null });
  const w = p.width - METER_W - 6;
  const layout = { graph: p.audio.graph, waveW: w, w, h: p.height - CORR_H - GAP, fullH: p.height };
  useFrames(() => {
    const l = p.audio.listening.current;
    if (l) advanceLive(shown.current.live, l, layout);
    paint(shown.current, parts, layout);
  });
  const text = statusText(p.audio.status);
  return (
    <div className="livewave" style={{ width: p.width, height: p.height }}>
      <div ref={parts.box} className="wavelanes" style={{ width: w, gap: GAP }}>
        <Graph graph={p.audio.graph} parts={parts} w={w} h={layout.h} />
        <canvas ref={parts.corr} title={CORR_TIP} style={{ width: w, height: CORR_H }} />
      </div>
      {text && <p className="livestatus">{text}</p>}
      <div className="meterbox" style={{ width: METER_W }}>
        <canvas ref={parts.meter} style={{ width: METER_W, height: p.height - READOUT_H }} />
        <button ref={parts.clip} className="clip" title={CLIP_TIP} onClick={() => clearClips(shown.current.live)} />
        <span ref={parts.readout} className="peak" />
      </div>
    </div>
  );
}
