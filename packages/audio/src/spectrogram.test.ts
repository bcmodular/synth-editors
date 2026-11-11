import { describe, expect, it } from "vitest";
import {
  createSpectrogram, levelAt, levelOf, magmaColours, spectrogramPixels, spectrogramStep, spectrogramX,
} from "./spectrogram";
import { columnHz } from "./spectrumView";

const RATE = 48000;
const FFT = 2048;
const RANGE = { floorDb: -100, topDb: -30 };

// 100 columns over 4 s (25 a second) and 50 rows.
const make = () => createSpectrogram({ width: 100, rows: 50 }, { rate: RATE, size: FFT, spanS: 4 });

// The analyser's bins: quiet, with a loud tone at `hz`.
function tone(bins: Float32Array, hz: number) {
  bins.fill(-120);
  bins[Math.round(hz / (RATE / FFT))] = -30;
}

describe("spectrogram", () => {
  it("spreads the dB range over 256 levels", () => {
    expect(levelOf(-100, RANGE)).toBe(0);
    expect(levelOf(-30, RANGE)).toBe(255);
    expect(levelOf(-65, RANGE)).toBe(128);
    expect(levelOf(0, RANGE)).toBe(255);
    expect(levelOf(-Infinity, RANGE)).toBe(0);
  });

  it("adds columns at the span's rate, whatever the frame rate", () => {
    const sg = make();
    spectrogramStep(sg, 1, RANGE); // the first step only sets the time
    expect(sg.head).toBe(0);
    for (let i = 1; i <= 60; i++) spectrogramStep(sg, 1 + i / 60, RANGE); // a second of 60 Hz frames
    expect(sg.head).toBe(25);
    spectrogramStep(sg, 2.5, RANGE); // a stalled half second
    expect(sg.head).toBeCloseTo(37, 0);
    spectrogramStep(sg, 60, RANGE); // a long stall fills it at most once round
    expect(sg.owed).toBeLessThan(1);
  });

  it("puts a tone in the row of its frequency, in the newest column", () => {
    const sg = make();
    tone(sg.bins, 1000);
    spectrogramStep(sg, 1, RANGE);
    spectrogramStep(sg, 1.04, RANGE);
    const newest = Array.from({ length: sg.rows }, (_, y) => levelAt(sg, sg.width - 1, y));
    const row = newest.indexOf(Math.max(...newest));
    expect(columnHz(row, sg.rows)).toBeGreaterThan(800);
    expect(columnHz(row, sg.rows)).toBeLessThan(1250);
    expect(levelAt(sg, 0, row)).toBe(0); // the oldest column is still empty
  });

  it("places an audio time across it, newest on the right", () => {
    const sg = make();
    spectrogramStep(sg, 10, RANGE);
    expect(spectrogramX(sg, 10)).toBe(99);
    expect(spectrogramX(sg, 8)).toBeCloseTo(49, 5);
    expect(spectrogramX(sg, 5)).toBeUndefined();
  });

  it("colours quiet dark and loud pale, the highest frequency on top", () => {
    const colours = magmaColours();
    expect([...colours.slice(0, 4)]).toEqual([0, 0, 4, 255]);
    expect([...colours.slice(255 * 4)]).toEqual([252, 253, 191, 255]);
    const sg = make();
    sg.levels.fill(0);
    sg.levels[(sg.width - 1) * sg.rows + (sg.rows - 1)] = 255; // the newest column's top row (head is 0)
    const px = new Uint8ClampedArray(sg.width * sg.rows * 4);
    spectrogramPixels(sg, colours, px);
    expect(px[(sg.width - 1) * 4]).toBe(252); // top right
    expect(px[0]).toBe(0);
  });
});
