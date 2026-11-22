import { describe, expect, it } from "vitest";
import { memoryDesk, studioShared } from "../../e2e/studio";
import { fx } from "./addresses";
import type { PlanContext } from "./planner";
import { CLOCK, roundBpm, START, STOP, syncedDelays, TempoMeter, tempoPlan, timeMs } from "./tempo";

// Clock ticks at a tempo, from a start time; returns the time after the last.
function feed(m: TempoMeter, bpm: number, beats: number, from = 0): number {
  const tick = 60_000 / bpm / 24;
  let at = from;
  for (let i = 0; i < beats * 24; i++) m.take([CLOCK], (at += tick));
  return at;
}

describe("TempoMeter", () => {
  it("measures the tempo once a beat has passed, and settles after another", () => {
    const m = new TempoMeter();
    feed(m, 120, 1);
    expect(m.last).toBeNull();
    feed(m, 120, 0.5, 500);
    expect(roundBpm(m.last!)).toBe(120);
    expect(m.settled).toBe(false); // not a whole beat of readings yet
    feed(m, 120, 1, 750);
    expect(m.settled).toBe(true);
  });

  it("isn't settled while the tempo is moving, and keeps the last tempo after Stop", () => {
    const m = new TempoMeter();
    let at = feed(m, 120, 3);
    at = feed(m, 126, 0.5, at);
    expect(m.settled).toBe(false);
    m.take([STOP], at);
    expect([m.running, m.last! > 120]).toEqual([false, true]);
    m.take([START], at + 1000);
    expect(m.running).toBe(true);
    feed(m, 90, 3, at + 1000);
    expect(roundBpm(m.last!)).toBe(90);
    expect(m.settled).toBe(true);
  });
});

function setup() {
  const desk = memoryDesk();
  const ctx: PlanContext = { get: (a) => desk.values.get(a), shared: studioShared };
  const set = (slot: number, type: number) => desk.values.set(fx(slot).type.address, type);
  return { desk, ctx, set };
}

describe("tempoPlan", () => {
  it("sets a stereo delay to an eighth and a rhythm delay to a quarter", () => {
    const { ctx, set } = setup();
    set(2, 12); // 4TAP
    set(3, 10); // DLY
    expect(syncedDelays(ctx).map((d) => [d.slot, d.name, d.beats])).toEqual([[2, "Rhythm Delay (4TAP)", 1], [3, "Stereo Delay (DLY)", 0.5]]);
    const plan = tempoPlan(ctx, 120);
    expect(plan.summary).toBe("Set the delays to 120 BPM: FX 2 500 ms, FX 3 250 ms");
    expect(plan.confirm).toBeNull();
    const w = Object.fromEntries(plan.changes.map((c) => [c.param.address, c.value as number]));
    expect(w["/fx/2/par/01"]).toBeCloseTo(499 / 2999, 6); // 4TAP Time is par 1
    expect(w["/fx/3/par/02"]).toBeCloseTo(249 / 2999, 6); // DLY Time is par 2
  });

  it("does nothing without delays, and keeps Time in range", () => {
    expect(tempoPlan(setup().ctx, 120).changes).toEqual([]);
    expect([timeMs(30, 1), timeMs(10, 1), timeMs(300, 0.5)]).toEqual([2000, 3000, 100]);
  });

  it("lists each delay's time and factors as the desk has them", () => {
    const { ctx, set, desk } = setup();
    set(3, 10);
    desk.values.set("/fx/3/par/04", 6);
    desk.values.set("/fx/3/par/05", 4);
    desk.values.set("/fx/3/par/02", 249 / 2999);
    expect(syncedDelays(ctx)[0]).toMatchObject({ time: "250 ms", factors: "Factor L 3/2, Factor R 1" });
  });
});
