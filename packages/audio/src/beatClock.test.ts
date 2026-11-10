import { describe, expect, it } from "vitest";
import { clockBpm, clockStep, isBar, newBeatClock, type BeatClock } from "./beatClock";

const TICK_MS = 60_000 / 120 / 24; // 120 BPM

function play(c: BeatClock, clocks: number, from: number): BeatClock {
  for (let i = 0; i < clocks; i++) c = clockStep(c, 0xf8, from + i * TICK_MS);
  return c;
}

describe("beatClock", () => {
  it("marks a beat every 24 clocks from Start, bars every 4 beats", () => {
    let c = clockStep(newBeatClock(), 0xfa, 0);
    c = play(c, 24 * 5, 0);
    expect(c.beats.map((b) => b.beat)).toEqual([0, 1, 2, 3, 4]);
    expect(c.beats.filter(isBar).map((b) => b.beat)).toEqual([0, 4]);
    expect(c.beats[1]!.at).toBeCloseTo(500);
    expect(c.fromStart).toBe(true);
  });

  it("reads the tempo, and none once the clock stops arriving", () => {
    const c = play(clockStep(newBeatClock(), 0xfa, 0), 48, 0);
    const last = 47 * TICK_MS;
    expect(clockBpm(c, last)).toBeCloseTo(120, 3);
    expect(clockBpm(c, last + 1000)).toBeUndefined();
  });

  it("counts from the first clock when it never saw Start, and Stop / Continue keep the count", () => {
    let c = play(newBeatClock(), 30, 0);
    expect(c.fromStart).toBe(false);
    c = clockStep(c, 0xfc, 1000);
    expect(c.running).toBe(false);
    c = clockStep(c, 0xfb, 1100);
    expect(c.running).toBe(true);
    expect(c.clocks).toBe(30);
  });

  it("drops beats older than 30 s", () => {
    const c = play(clockStep(newBeatClock(), 0xfa, 0), 24 * 70, 0); // 35 s at 120 BPM
    expect(c.beats[0]!.at).toBeGreaterThanOrEqual(c.lastAt! - 30_000);
  });
});
