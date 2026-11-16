import { describe, expect, it } from "vitest";
import { CLOCK, ClockGenerator, forwards, START, STOP, TempoMeter, tickMs, type ClockClock } from "./clock";

// A clock that only moves when told to.
function fakeTime() {
  let now = 1000;
  let timer: (() => void) | undefined;
  const time: ClockClock = {
    now: () => now,
    every: (_ms, fn) => {
      timer = fn;
      return () => (timer = undefined);
    },
  };
  return { time, advance: (ms: number) => ((now += ms), timer?.()), running: () => timer !== undefined };
}

function generator(bpm = 120) {
  const sent: { data: number[]; at?: number }[] = [];
  const t = fakeTime();
  const gen = new ClockGenerator((data, at) => sent.push({ data, at }), t.time, bpm);
  return { gen, sent, ...t };
}

describe("tickMs", () => {
  it("is 24 ticks per beat", () => {
    expect(tickMs(120)).toBeCloseTo(500 / 24);
    expect(tickMs(60)).toBeCloseTo(1000 / 24);
  });

  it("keeps the tempo in range", () => {
    expect(tickMs(0)).toBe(tickMs(30));
    expect(tickMs(1000)).toBe(tickMs(300));
  });
});

describe("ClockGenerator", () => {
  it("schedules ticks ahead with timestamps, evenly spaced", () => {
    const g = generator(120);
    g.gen.start(false);
    const times = g.sent.map((s) => s.at!);
    expect(g.sent.every((s) => s.data[0] === CLOCK)).toBe(true);
    expect(times[0]).toBe(1000);
    expect(times[1]! - times[0]!).toBeCloseTo(500 / 24);
    expect(times.at(-1)).toBeLessThanOrEqual(1100); // no further ahead than the lookahead
  });

  it("sends one beat of ticks per beat", () => {
    const g = generator(120);
    g.gen.start(false);
    for (let i = 0; i < 25; i++) g.advance(20); // 500 ms
    const inFirstBeat = g.sent.filter((s) => s.at! < 1500);
    expect(inFirstBeat).toHaveLength(24);
  });

  it("sends Start and Stop around the clock when asked", () => {
    const g = generator();
    g.gen.start(true);
    g.advance(20);
    g.gen.stop(true);
    expect(g.sent[0]).toEqual({ data: [START], at: 1000 });
    expect(g.sent.at(-1)!.data).toEqual([STOP]);
    expect(g.running()).toBe(false);
  });

  it("sends clock only without transport", () => {
    const g = generator();
    g.gen.start(false);
    g.gen.stop(false);
    expect(g.sent.every((s) => s.data[0] === CLOCK)).toBe(true);
  });

  it("changes tempo from the next tick", () => {
    const g = generator(120);
    g.gen.start(false);
    g.gen.setBpm(60);
    const before = g.sent.length;
    g.advance(100);
    const later = g.sent.slice(before - 1).map((s) => s.at!);
    expect(later[2]! - later[1]!).toBeCloseTo(1000 / 24);
  });
});

describe("forwards", () => {
  it("forwards clock, and transport only when asked", () => {
    expect(forwards([CLOCK], false)).toBe(true);
    expect(forwards([START], false)).toBe(false);
    expect(forwards([START], true)).toBe(true);
    expect(forwards([0xfb], true)).toBe(true);
    expect(forwards([STOP], true)).toBe(true);
  });

  it("forwards nothing else", () => {
    expect(forwards([0x90, 60, 100], true)).toBe(false);
    expect(forwards([0xfe], true)).toBe(false); // active sensing
    expect(forwards([0xf2, 0, 0], true)).toBe(false); // song position
  });
});

describe("TempoMeter", () => {
  it("measures the tempo over one beat", () => {
    const m = new TempoMeter();
    for (let i = 0; i < 24; i++) m.tick(i * (500 / 24));
    expect(m.bpm).toBeUndefined();
    m.tick(500);
    expect(m.bpm).toBeCloseTo(120);
    for (let i = 1; i <= 24; i++) m.tick(500 + i * (1000 / 24));
    expect(m.bpm).toBeCloseTo(60);
  });
});
