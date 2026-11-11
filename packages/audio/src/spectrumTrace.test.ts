import { describe, expect, it } from "vitest";
import { createSpectrumTrace, SPECTRUM_EVERY_S, spectrumTraceFor, stepSpectrumTrace } from "./spectrumTrace";

const FFT = { rate: 48000, size: 1024 };
const flat = (db: number) => (into: Float32Array) => into.fill(db);

describe("spectrum trace", () => {
  it("starts silent and fills the line and peaks from the first read", () => {
    const t = createSpectrumTrace(64, FFT);
    expect(t.line.every((v) => v === -Infinity)).toBe(true);
    stepSpectrumTrace(t, flat(-60), 1);
    expect(t.line.every(Number.isFinite)).toBe(true);
    expect(Array.from(t.peaks)).toEqual(Array.from(t.line));
  });

  it("skips reads closer together than the update interval", () => {
    const t = createSpectrumTrace(64, FFT);
    let reads = 0;
    const read = (into: Float32Array) => (reads++, into.fill(-60));
    stepSpectrumTrace(t, read, 1);
    stepSpectrumTrace(t, read, 1 + SPECTRUM_EVERY_S / 2);
    stepSpectrumTrace(t, read, 1 + SPECTRUM_EVERY_S * 1.5);
    expect(reads).toBe(2);
  });

  it("lets the peaks fall behind a quieter line", () => {
    const t = createSpectrumTrace(64, FFT);
    stepSpectrumTrace(t, flat(-40), 1);
    stepSpectrumTrace(t, flat(-80), 2);
    expect(t.peaks[10]!).toBeGreaterThan(t.line[10]!);
    expect(t.peaks[10]!).toBeLessThan(t.line[10]! + 40);
  });

  it("keeps a trace that still fits and replaces one that doesn't", () => {
    const t = createSpectrumTrace(64, FFT);
    expect(spectrumTraceFor(t, 64, FFT)).toBe(t);
    expect(spectrumTraceFor(t, 80, FFT)).not.toBe(t);
    expect(spectrumTraceFor(null, 64, FFT).plan.columns).toBe(64);
  });
});
