// VCO MIX's LIVE view: the TB-3's output as scrolling L and R waveforms, a stereo correlation bar and a level
// meter (docs/tb3-live-waveform-design.md). Drawn each animation frame, outside React's renders.
import { useEffect, useRef } from "react";
import type { RefObject } from "react";
import {
  clearClip, correlationOf, createCorrelation, createWaveColumns, drawCorrelation, drawMeter, drawWave, formatDb,
  meterStep, paletteOf, pushCorrelation, pushSamples, samplesPerColumn, silentMeter, surfaceOf,
} from "@synth-editors/audio";
import type { Correlation, Meter, Palette, WaveColumns } from "@synth-editors/audio";
import type { Listening } from "./tb3Audio";
import type { AudioStatus, Tb3Audio } from "./useTb3Audio";

const LIVE_SPAN_S = 4;
const METER_W = 30;
const READOUT_H = 34;
const CORR_H = 10;
const GAP = 3;
const CLIP_TIP = "Clip light and highest peak (dBFS) since the last click: click to clear";
const CORR_TIP = "Stereo correlation: right of centre is alike in both sides (+1 is mono), left is out of phase";

type Pair<T> = [T, T];
type Canvases = [HTMLCanvasElement, HTMLCanvasElement, HTMLCanvasElement, HTMLCanvasElement];

interface Shown {
  waves: Pair<WaveColumns> | null;
  corr: Correlation | null;
  meters: Pair<Meter>;
  palette: Palette | null;
}

const emptyShown = (): Shown => ({ waves: null, corr: null, meters: [silentMeter(), silentMeter()], palette: null });

function start(s: Shown, rate: number, waveW: number) {
  const perColumn = samplesPerColumn(LIVE_SPAN_S, waveW, rate);
  s.waves = [createWaveColumns(waveW, perColumn), createWaveColumns(waveW, perColumn)];
  s.corr = createCorrelation(rate);
}

// Feed one frame of audio into the waveforms, correlation and meters.
function advance(s: Shown, l: Listening, waveW: number) {
  const f = l.read();
  if (!s.waves || s.corr?.rate !== l.sampleRate) start(s, l.sampleRate, waveW);
  pushSamples(s.waves![0], f.left);
  pushSamples(s.waves![1], f.right);
  pushCorrelation(s.corr!, f.left, f.right);
  s.meters = [meterStep(s.meters[0], f.left, f.now), meterStep(s.meters[1], f.right, f.now)];
}

interface Parts {
  lanes: RefObject<HTMLDivElement | null>;
  left: RefObject<HTMLCanvasElement | null>;
  right: RefObject<HTMLCanvasElement | null>;
  corr: RefObject<HTMLCanvasElement | null>;
  meter: RefObject<HTMLCanvasElement | null>;
  readout: RefObject<HTMLSpanElement | null>;
  clip: RefObject<HTMLButtonElement | null>;
}

interface Size {
  waveW: number;
  laneH: number;
  h: number;
}

const laneHeight = (h: number) => (h - CORR_H - 2 * GAP) / 2;

function paintReadouts(s: Shown, parts: Parts) {
  const [l, r] = s.meters;
  parts.readout.current!.textContent = formatDb(Math.max(l.maxDb, r.maxDb)).replace(" dB", "");
  parts.clip.current!.classList.toggle("on", l.clipped || r.clipped);
  const lanes = parts.lanes.current!.dataset; // for tests
  lanes.level = String(Math.max(l.db, r.db));
  lanes.correlation = String(s.corr ? correlationOf(s.corr) : NaN);
}

function paint(s: Shown, parts: Parts, size: Size) {
  const canvases = [parts.left.current, parts.right.current, parts.corr.current, parts.meter.current];
  if (!canvases.every(Boolean)) return;
  const [left, right, corr, meter] = canvases as Canvases;
  const p = (s.palette ??= paletteOf(left));
  const lane = { w: size.waveW, h: size.laneH };
  drawWave(surfaceOf(left, lane, p), s.waves?.[0] ?? null);
  drawWave(surfaceOf(right, lane, p), s.waves?.[1] ?? null);
  drawCorrelation(surfaceOf(corr, { w: size.waveW, h: CORR_H }, p), s.corr ? correlationOf(s.corr) : NaN);
  drawMeter(surfaceOf(meter, { w: METER_W, h: size.h - READOUT_H }, p), s.meters);
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

function Lane(p: { side: "L" | "R"; canvas: RefObject<HTMLCanvasElement | null>; w: number; h: number }) {
  return (
    <div className="lane">
      <canvas ref={p.canvas} style={{ width: p.w, height: p.h }} />
      <span className="lanelabel">{p.side}</span>
    </div>
  );
}

export function LiveWave(p: { audio: Tb3Audio; width: number; height: number }) {
  const parts: Parts = { lanes: useRef(null), left: useRef(null), right: useRef(null), corr: useRef(null),
    meter: useRef(null), readout: useRef(null), clip: useRef(null) };
  const shown = useRef<Shown>(emptyShown());
  const size: Size = { waveW: p.width - METER_W - 6, laneH: laneHeight(p.height), h: p.height };
  useFrames(() => {
    const l = p.audio.listening.current;
    if (l) advance(shown.current, l, size.waveW);
    paint(shown.current, parts, size);
  });
  const clear = () => {
    const s = shown.current;
    s.meters = [clearClip(s.meters[0]), clearClip(s.meters[1])];
  };
  const text = statusText(p.audio.status);
  return (
    <div className="livewave" style={{ width: p.width, height: p.height }}>
      <div ref={parts.lanes} className="wavelanes" style={{ width: size.waveW, gap: GAP }}>
        <Lane side="L" canvas={parts.left} w={size.waveW} h={size.laneH} />
        <Lane side="R" canvas={parts.right} w={size.waveW} h={size.laneH} />
        <canvas ref={parts.corr} title={CORR_TIP} style={{ width: size.waveW, height: CORR_H }} />
      </div>
      {text && <p className="livestatus">{text}</p>}
      <div className="meterbox" style={{ width: METER_W }}>
        <canvas ref={parts.meter} style={{ width: METER_W, height: p.height - READOUT_H }} />
        <button ref={parts.clip} className="clip" title={CLIP_TIP} onClick={clear} />
        <span ref={parts.readout} className="peak" />
      </div>
    </div>
  );
}
