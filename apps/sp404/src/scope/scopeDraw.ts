// Canvas drawing for the SCOPE view (docs/sp404-design.md › Scopes): the spectrum with its frequency and level
// grid, and the beat grid over a waveform lane. The waveform, meter and correlation bar come from
// packages/audio (shared with the TB-3).

import { hzFraction, isBar } from "@synth-editors/audio";
import type { Beat, Surface } from "@synth-editors/audio";

export const SPECTRUM_TOP_DB = -20; // the analyser reads a band-averaged full-scale tone near −40
export const SPECTRUM_FLOOR_DB = -110;
const DB_STEP = 10;
const GRID_HZ = [50, 100, 200, 500, 1000, 2000, 5000, 10000];
const LABEL_FONT = "10px 'DIN Condensed', 'Avenir Next Condensed', sans-serif";

const SPECTRUM_RANGE_DB = SPECTRUM_TOP_DB - SPECTRUM_FLOOR_DB;
const yOfDb = (db: number, h: number) => h * Math.min(1, Math.max(0, (SPECTRUM_TOP_DB - db) / SPECTRUM_RANGE_DB));
const hzLabel = (hz: number) => (hz >= 1000 ? `${hz / 1000}k` : String(hz));

function spectrumGrid({ g, w, h, p }: Surface) {
  g.fillStyle = p.well;
  g.fillRect(0, 0, w, h);
  g.font = LABEL_FONT;
  g.fillStyle = p.axis;
  for (let db = SPECTRUM_TOP_DB - DB_STEP; db > SPECTRUM_FLOOR_DB; db -= DB_STEP) {
    g.fillRect(0, Math.round(yOfDb(db, h)), w, 1);
  }
  for (const hz of GRID_HZ) g.fillRect(Math.round(hzFraction(hz) * w), 0, 1, h);
  g.fillStyle = p.hold;
  g.globalAlpha = 0.5;
  for (const hz of GRID_HZ) g.fillText(hzLabel(hz), Math.round(hzFraction(hz) * w) + 3, h - 4);
  for (let db = SPECTRUM_TOP_DB - DB_STEP * 2; db > SPECTRUM_FLOOR_DB; db -= DB_STEP * 2)
    g.fillText(String(db).replace("-", "−"), 3, yOfDb(db, h) - 3);
  g.globalAlpha = 1;
}

function tracePath(g: CanvasRenderingContext2D, values: Float32Array, size: { w: number; h: number }) {
  const step = size.w / Math.max(1, values.length - 1);
  g.beginPath();
  values.forEach((db, x) => {
    const y = yOfDb(Number.isFinite(db) ? db : SPECTRUM_FLOOR_DB, size.h);
    if (x === 0) g.moveTo(0, y);
    else g.lineTo(x * step, y);
  });
}

// The smoothed line with a fill below it, and the falling peak line above.
export function drawSpectrum(s: Surface, line: Float32Array | null, peaks: Float32Array | null) {
  spectrumGrid(s);
  if (!line || !peaks) return;
  const { g, w, h, p } = s;
  tracePath(g, line, { w, h });
  g.lineTo(w, h);
  g.lineTo(0, h);
  g.closePath();
  g.fillStyle = p.trace;
  g.globalAlpha = 0.18;
  g.fill();
  g.globalAlpha = 1;
  tracePath(g, line, { w, h });
  g.strokeStyle = p.trace;
  g.lineWidth = 1.5;
  g.stroke();
  tracePath(g, peaks, { w, h });
  g.strokeStyle = p.hold;
  g.globalAlpha = 0.45;
  g.lineWidth = 1;
  g.stroke();
  g.globalAlpha = 1;
}

// Beat lines over a waveform lane: bars brighter and numbered (when `numbered`).
export function drawBeats(s: Surface, beats: { beat: Beat; x: number }[], numbered: boolean) {
  const { g, h, p } = s;
  g.font = LABEL_FONT;
  for (const { beat, x } of beats) {
    const bar = isBar(beat);
    g.fillStyle = p.hold;
    g.globalAlpha = bar ? 0.55 : 0.18;
    g.fillRect(Math.round(x), 0, 1, h);
    if (bar && numbered) {
      g.globalAlpha = 0.7;
      g.fillText(String(beat.beat / 4 + 1), Math.round(x) + 3, 11);
    }
  }
  g.globalAlpha = 1;
}


