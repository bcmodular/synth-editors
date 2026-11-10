// Canvas drawing for the LIVE waveform and level meter (docs/tb3-live-waveform-design.md).
import { forEachColumn } from "./waveColumns";
import type { WaveColumns } from "./waveColumns";
import { meterFraction } from "./levelMeter";
import type { Meter } from "./levelMeter";

export interface Palette {
  well: string;
  axis: string;
  trace: string;
  meter: string;
  hot: string; // the top of the meter, near full scale
  hold: string;
}

export function paletteOf(el: Element): Palette {
  const css = getComputedStyle(el);
  const v = (name: string, fallback: string) => css.getPropertyValue(name).trim() || fallback;
  return {
    well: v("--well-dark", "#1a1b1e"),
    axis: "#2e2f34",
    trace: v("--led", "#3ddc5a"),
    meter: v("--led", "#3ddc5a"),
    hot: v("--alt", "#ffb020"),
    hold: v("--text", "#d4d5da"),
  };
}

// A canvas to draw on: its context, size in CSS px and colours.
export interface Surface {
  g: CanvasRenderingContext2D;
  w: number;
  h: number;
  p: Palette;
}

// Size a canvas's backing store for sharp lines on high-density screens.
export function surfaceOf(canvas: HTMLCanvasElement, size: { w: number; h: number }, p: Palette): Surface {
  const dpr = window.devicePixelRatio || 1;
  if (canvas.width !== size.w * dpr) canvas.width = size.w * dpr;
  if (canvas.height !== size.h * dpr) canvas.height = size.h * dpr;
  const g = canvas.getContext("2d")!;
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { g, ...size, p };
}

const AMP_PAD = 6;

// Each column as a vertical band from its lowest to its highest sample, at least a pixel tall.
export function drawWave({ g, w, h, p }: Surface, cols: WaveColumns | null) {
  const mid = h / 2;
  const amp = mid - AMP_PAD;
  g.fillStyle = p.well;
  g.fillRect(0, 0, w, h);
  g.fillStyle = p.axis;
  g.fillRect(0, Math.round(mid), w, 1);
  if (!cols) return;
  const scale = w / cols.width;
  g.fillStyle = p.trace;
  forEachColumn(cols, (x, min, max) => {
    const top = mid - max * amp;
    const height = Math.max(1, (max - min) * amp);
    g.fillRect(x * scale, top, Math.max(1, scale), height);
  });
}

const HOT_DB_FRACTION = meterFraction(-6); // above −6 dBFS the bar turns amber

function drawBar({ g, h, p }: Surface, m: Meter, bar: { x: number; bw: number }) {
  const { x, bw } = bar;
  const f = meterFraction(m.db);
  const hotY = h * (1 - HOT_DB_FRACTION);
  const top = h * (1 - f);
  g.fillStyle = p.meter;
  g.fillRect(x, Math.max(top, hotY), bw, h - Math.max(top, hotY));
  if (top < hotY) {
    g.fillStyle = p.hot;
    g.fillRect(x, top, bw, hotY - top);
  }
  const hold = meterFraction(m.holdDb);
  if (hold > 0) {
    g.fillStyle = p.hold;
    g.fillRect(x, h * (1 - hold), bw, 2);
  }
}

// Two bars, left and right, side by side.
export function drawMeter(s: Surface, meters: [Meter, Meter]) {
  const gap = 4;
  const bw = (s.w - gap) / 2;
  s.g.fillStyle = s.p.well;
  s.g.fillRect(0, 0, s.w, s.h);
  meters.forEach((m, i) => drawBar(s, m, { x: i * (bw + gap), bw }));
}
