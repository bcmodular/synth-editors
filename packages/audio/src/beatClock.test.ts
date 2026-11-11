import { describe, expect, it } from "vitest";
import { clockBpm, clockStep, newBeatClock, steadyBpm, type BeatClock } from "./beatClock";

const TICK_MS = 60_000 / 120 / 24; // 120 BPM

function play(c: BeatClock, clocks: number, from: number): BeatClock {
  for (let i = 0; i < clocks; i++) c = clockStep(c, 0xf8, from + i * TICK_MS);
  return c;
}

describe("beatClock", () => {
  it("reads the tempo, and none once the clock stops arriving", () => {
    const c = play(clockStep(newBeatClock(), 0xfa, 0), 48, 0);
    const last = 47 * TICK_MS;
    expect(clockBpm(c, last)).toBeCloseTo(120, 3);
    expect(clockBpm(c, last + 1000)).toBeUndefined();
  });

  it("reads a jittery clock steadily", () => {
    let c = clockStep(newBeatClock(), 0xfa, 0);
    const jitter = [3, -2, 0, 4, -4, 1, -3, 2]; // ms either way, as USB MIDI arrives
    for (let i = 0; i < 24 * 8; i++) c = clockStep(c, 0xf8, i * TICK_MS + jitter[i % jitter.length]!);
    const bpm = clockBpm(c, c.lastAt!)!;
    expect(Math.abs(bpm - 120)).toBeLessThan(0.15);
  });

  it("keeps the shown tempo on the edge between tenths and follows real changes", () => {
    expect(steadyBpm(undefined, 119.96)).toBe(120);
    expect(steadyBpm(120, 120.051)).toBe(120); // on the edge: no flicker to 120.1
    expect(steadyBpm(120, 119.948)).toBe(120);
    expect(steadyBpm(165.2, 165.0)).toBe(165); // never stuck a tenth or more off
    expect(steadyBpm(120, 121.04)).toBe(121);
    expect(steadyBpm(120, undefined)).toBeUndefined();
  });

  it("Start reads the tempo afresh; Stop and Continue keep it", () => {
    let c = play(newBeatClock(), 30, 0);
    c = clockStep(c, 0xfc, 1000);
    expect(c.running).toBe(false);
    c = clockStep(c, 0xfb, 1100);
    expect(c.running).toBe(true);
    expect(c.recent).toHaveLength(30);
    expect(clockStep(c, 0xfa, 1200).recent).toEqual([]);
  });
});
