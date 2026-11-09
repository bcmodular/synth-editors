import { describe, expect, it } from "vitest";
import { createPacer, gapAfter, sendOffsets } from "./pacer";

const clockAt = (start: number) => {
  const c = { t: start, now: () => c.t };
  return c;
};
const twoMs = () => 2;

describe("createPacer", () => {
  it("sends a lone message now", () => {
    const c = clockAt(100);
    expect(createPacer(twoMs, c.now).at(10)).toBe(100);
  });

  it("spaces a burst out by the gap", () => {
    const c = clockAt(100);
    const p = createPacer(twoMs, c.now);
    expect([p.at(10), p.at(10), p.at(10), p.at(10)]).toEqual([100, 102, 104, 106]);
  });

  it("leaves a longer gap after a longer message", () => {
    const c = clockAt(0);
    const p = createPacer(gapAfter, c.now);
    p.at(100);
    expect(p.at(10)).toBeCloseTo(gapAfter(100));
  });

  it("goes straight away again once the burst has gone", () => {
    const c = clockAt(100);
    const p = createPacer(twoMs, c.now);
    p.at(10);
    p.at(10);
    c.t = 110;
    expect(p.at(10)).toBe(110);
  });

  it("queues behind a burst that hasn't gone yet, and says how far behind it is", () => {
    const c = clockAt(100);
    const p = createPacer(twoMs, c.now);
    [1, 2, 3].forEach(() => p.at(10)); // 100, 102, 104
    c.t = 103;
    expect(p.backlog()).toBe(3);
    expect(p.at(10)).toBe(106);
    c.t = 200;
    expect(p.backlog()).toBe(0);
  });
});

describe("sendOffsets", () => {
  it("paces a run like the app does", () => {
    const msgs = [Array(100).fill(0), Array(20).fill(0), Array(20).fill(0)];
    expect(sendOffsets(msgs)).toEqual([0, gapAfter(100), gapAfter(100) + gapAfter(20)]);
  });
});
