import { describe, expect, it } from "vitest";
import {
  createLoudness, formatLufs, integratedLufs, kWeighting, pushLoudness, resetIntegrated, shortTermLufs,
} from "./loudness";

const RATE = 48000;

function sine(seconds: number, amplitude: number, hz = 1000) {
  const out = new Float32Array(Math.round(seconds * RATE));
  for (let i = 0; i < out.length; i++) out[i] = amplitude * Math.sin((2 * Math.PI * hz * i) / RATE);
  return out;
}

const dbfs = (db: number) => 10 ** (db / 20);

describe("loudness", () => {
  it("has the BS.1770 K-weighting coefficients at 48 kHz", () => {
    const [shelf, hp] = kWeighting(48000);
    expect(shelf.b0).toBeCloseTo(1.53512485958697, 9);
    expect(shelf.b1).toBeCloseTo(-2.69169618940638, 9);
    expect(shelf.b2).toBeCloseTo(1.19839281085285, 9);
    expect(shelf.a1).toBeCloseTo(-1.69065929318241, 9);
    expect(shelf.a2).toBeCloseTo(0.73248077421585, 9);
    expect(hp.a1).toBeCloseTo(-1.99004745483398, 9);
    expect(hp.a2).toBeCloseTo(0.99007225036621, 9);
  });

  it("reads a full-scale 1 kHz sine on one channel as −3.01 LUFS", () => {
    const m = createLoudness(RATE);
    pushLoudness(m, sine(4, 1), new Float32Array(4 * RATE));
    expect(shortTermLufs(m)).toBeCloseTo(-3.01, 1);
  });

  it("reads a −20 dBFS sine on both channels as −20 LUFS, short-term and integrated", () => {
    const m = createLoudness(RATE);
    const s = sine(5, dbfs(-20));
    pushLoudness(m, s, s);
    expect(shortTermLufs(m)).toBeCloseTo(-20, 1);
    expect(integratedLufs(m)).toBeCloseTo(-20, 1);
    expect(formatLufs(shortTermLufs(m))).toBe("−20.0");
  });

  it("works when the samples arrive in odd-sized frames", () => {
    const m = createLoudness(RATE);
    const s = sine(4, dbfs(-20));
    for (let at = 0; at < s.length; at += 777) pushLoudness(m, s.subarray(at, at + 777), s.subarray(at, at + 777));
    expect(shortTermLufs(m)).toBeCloseTo(-20, 1);
  });

  it("short-term follows the last 3 s only", () => {
    const m = createLoudness(RATE);
    const loud = sine(4, dbfs(-10));
    const quiet = sine(4, dbfs(-30));
    pushLoudness(m, loud, loud);
    pushLoudness(m, quiet, quiet);
    expect(shortTermLufs(m)).toBeCloseTo(-30, 1);
  });

  it("integrated ignores silence (absolute gate) and much quieter passages (relative gate)", () => {
    const m = createLoudness(RATE);
    const silence = new Float32Array(5 * RATE);
    const loud = sine(10, dbfs(-20));
    const quiet = sine(10, dbfs(-40));
    pushLoudness(m, silence, silence);
    pushLoudness(m, loud, loud);
    pushLoudness(m, quiet, quiet);
    expect(Math.abs(integratedLufs(m) - -20)).toBeLessThan(0.3);
  });

  it("starts integrated again after a reset", () => {
    const m = createLoudness(RATE);
    const loud = sine(3, dbfs(-10));
    const quiet = sine(3, dbfs(-25));
    pushLoudness(m, loud, loud);
    resetIntegrated(m);
    pushLoudness(m, quiet, quiet);
    expect(Math.abs(integratedLufs(m) - -25)).toBeLessThan(0.5);
  });

  it("reads silence as –", () => {
    const m = createLoudness(RATE);
    pushLoudness(m, new Float32Array(RATE), new Float32Array(RATE));
    expect(formatLufs(shortTermLufs(m))).toBe("–");
    expect(formatLufs(integratedLufs(m))).toBe("–");
  });
});
