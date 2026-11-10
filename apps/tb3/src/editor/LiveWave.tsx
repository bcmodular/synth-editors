// VCO MIX's LIVE view: the TB-3's output as a scrolling waveform with a stereo level meter
// (docs/tb3-live-waveform-design.md). Drawn each animation frame, outside React's renders.
import { useEffect, useRef } from "react";
import type { RefObject } from "react";
import { clearClip, createWaveColumns, drawMeter, drawWave, formatDb, meterStep, paletteOf, pushSamples, samplesPerColumn,
  silentMeter, surfaceOf } from "@synth-editors/audio";
import type { Meter, Palette, WaveColumns } from "@synth-editors/audio";
import type { Listening } from "./tb3Audio";
import type { AudioStatus, Tb3Audio } from "./useTb3Audio";

const LIVE_SPAN_S = 4;
const METER_W = 30;
const READOUT_H = 34;
const CLIP_TIP = "Clip light and highest peak (dBFS) since the last click: click to clear";

interface Shown {
  cols: WaveColumns | null;
  rate: number;
  meters: [Meter, Meter];
  palette: Palette | null;
}

const emptyShown = (): Shown => ({ cols: null, rate: 0, meters: [silentMeter(), silentMeter()], palette: null });

// Feed one frame of audio into the columns and meters.
function advance(s: Shown, l: Listening, waveW: number) {
  const f = l.read();
  if (!s.cols || s.rate !== l.sampleRate) {
    s.cols = createWaveColumns(waveW, samplesPerColumn(LIVE_SPAN_S, waveW, l.sampleRate));
    s.rate = l.sampleRate;
  }
  pushSamples(s.cols, f.mix);
  s.meters = [meterStep(s.meters[0], f.left, f.now), meterStep(s.meters[1], f.right, f.now)];
}

interface Parts {
  wave: RefObject<HTMLCanvasElement | null>;
  meter: RefObject<HTMLCanvasElement | null>;
  readout: RefObject<HTMLSpanElement | null>;
  clip: RefObject<HTMLButtonElement | null>;
}

function paint(s: Shown, parts: Parts, size: { waveW: number; h: number }) {
  const wave = parts.wave.current;
  const meter = parts.meter.current;
  if (!wave || !meter) return;
  const p = (s.palette ??= paletteOf(wave));
  drawWave(surfaceOf(wave, { w: size.waveW, h: size.h }, p), s.cols);
  drawMeter(surfaceOf(meter, { w: METER_W, h: size.h - READOUT_H }, p), s.meters);
  const [l, r] = s.meters;
  parts.readout.current!.textContent = formatDb(Math.max(l.maxDb, r.maxDb)).replace(" dB", "");
  parts.clip.current!.classList.toggle("on", l.clipped || r.clipped);
  wave.dataset.level = String(Math.max(l.db, r.db)); // for tests
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

export function LiveWave(p: { audio: Tb3Audio; width: number; height: number }) {
  const parts: Parts = { wave: useRef(null), meter: useRef(null), readout: useRef(null), clip: useRef(null) };
  const shown = useRef<Shown>(emptyShown());
  const waveW = p.width - METER_W - 6;
  useFrames(() => {
    const l = p.audio.listening.current;
    if (l) advance(shown.current, l, waveW);
    paint(shown.current, parts, { waveW, h: p.height });
  });
  const clear = () => {
    const s = shown.current;
    s.meters = [clearClip(s.meters[0]), clearClip(s.meters[1])];
  };
  const text = statusText(p.audio.status);
  return (
    <div className="livewave" style={{ width: p.width, height: p.height }}>
      <canvas ref={parts.wave} className="wavecanvas" style={{ width: waveW, height: p.height }} />
      {text && <p className="livestatus">{text}</p>}
      <div className="meterbox" style={{ width: METER_W }}>
        <canvas ref={parts.meter} style={{ width: METER_W, height: p.height - READOUT_H }} />
        <button ref={parts.clip} className="clip" title={CLIP_TIP} onClick={clear} />
        <span ref={parts.readout} className="peak" />
      </div>
    </div>
  );
}
