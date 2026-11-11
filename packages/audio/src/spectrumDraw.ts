// Canvas drawing for the spectrum and spectrogram scopes (docs/sp404-design.md › Scopes), shared by the SP-404's
// SCOPE view and the TB-3's LIVE view: the spectrum with its frequency and level grid, and the spectrogram with its
// frequency grid.

import type { Surface } from "./liveDraw";
import { magmaColours, spectrogramPixels } from "./spectrogram";
import type { Spectrogram } from "./spectrogram";
import { hzFraction } from "./spectrumView";

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

const MAGMA = magmaColours();
const SPECTROGRAM_GRID_HZ = [100, 1000, 10000];

// An offscreen canvas the spectrogram's pixels go into (one pixel per column and row), then drawn scaled.
let pixels: { canvas: HTMLCanvasElement; image: ImageData } | null = null;
function pixelsFor({ width, rows }: Spectrogram) {
  if (pixels?.image.width === width && pixels.image.height === rows) return pixels;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = rows;
  return (pixels = { canvas, image: new ImageData(width, rows) });
}

function spectrogramGrid({ g, w, h, p }: Surface) {
  g.font = LABEL_FONT;
  for (const hz of SPECTROGRAM_GRID_HZ) {
    const y = Math.round(h * (1 - hzFraction(hz)));
    g.fillStyle = p.hold;
    g.globalAlpha = 0.15;
    g.fillRect(0, y, w, 1);
    g.globalAlpha = 0.6;
    g.fillText(hzLabel(hz), 3, y - 3);
  }
  g.globalAlpha = 1;
}

// The spectrogram scaled to the canvas, with lines at 100 Hz, 1 kHz and 10 kHz.
export function drawSpectrogram(s: Surface, sg: Spectrogram | null) {
  const { g, w, h, p } = s;
  g.fillStyle = p.well;
  g.fillRect(0, 0, w, h);
  if (sg) {
    const px = pixelsFor(sg);
    spectrogramPixels(sg, MAGMA, px.image.data);
    px.canvas.getContext("2d")!.putImageData(px.image, 0, 0);
    g.imageSmoothingEnabled = true;
    g.drawImage(px.canvas, 0, 0, w, h);
  }
  spectrogramGrid(s);
}
