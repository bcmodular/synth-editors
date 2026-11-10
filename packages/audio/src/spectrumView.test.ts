import { describe, expect, it } from "vitest";
import { columnHz, fallPeaks, hzFraction, planSpectrum, PEAK_FALL_DB_PER_S, spectrumColumns } from "./spectrumView";

describe("spectrumView", () => {
  it("spaces columns from 20 Hz to 20 kHz on a log axis", () => {
    expect(columnHz(0, 101)).toBeCloseTo(20);
    expect(columnHz(100, 101)).toBeCloseTo(20000);
    expect(columnHz(50, 101)).toBeCloseTo(Math.sqrt(20 * 20000));
    expect(hzFraction(632.4555)).toBeCloseTo(0.5, 4);
  });

  it("puts a single-bin peak at the column of its frequency, tilted about 1 kHz", () => {
    const rate = 48000;
    const size = 8192;
    const plan = planSpectrum(300, rate, size);
    const bins = new Float32Array(size / 2).fill(-Infinity);
    const bin = Math.round(1000 / (rate / size));
    bins[bin] = -20;
    const out = new Float32Array(300);
    spectrumColumns(plan, bins, out);
    const best = out.indexOf(Math.max(...out));
    expect(columnHz(best, 300)).toBeGreaterThan(950);
    expect(columnHz(best, 300)).toBeLessThan(1050);
    expect(out[0]).toBe(-Infinity);
  });

  it("reads a flat spectrum as rising 4.5 dB per octave", () => {
    const plan = planSpectrum(200, 48000, 8192);
    const out = new Float32Array(200);
    spectrumColumns(plan, new Float32Array(4096).fill(-60), out);
    const x1k = plan.tilt.findIndex((t) => t >= 0);
    const x2k = plan.tilt.findIndex((t) => t >= 4.5);
    expect(out[x1k]!).toBeCloseTo(-60, 0);
    expect(out[x2k]! - out[x1k]!).toBeCloseTo(4.5, 0);
  });

  it("lets peaks rise at once and fall slowly", () => {
    const peaks = new Float32Array([-Infinity, -10]);
    fallPeaks(peaks, [-30, -60], 0.5);
    expect(peaks[0]).toBe(-30);
    expect(peaks[1]).toBeCloseTo(-10 - PEAK_FALL_DB_PER_S * 0.5);
  });
});
