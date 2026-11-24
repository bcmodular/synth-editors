import { describe, expect, it } from "vitest";
import { CLOCK, CONTINUE, forwards, START, STOP, TempoMeter } from "./clock";

describe("forwards", () => {
  it("forwards clock, Start, Continue and Stop", () => {
    for (const status of [CLOCK, START, CONTINUE, STOP]) expect(forwards([status])).toBe(true);
  });

  it("forwards nothing else", () => {
    expect(forwards([0x90, 60, 100])).toBe(false);
    expect(forwards([0xfe])).toBe(false); // active sensing
    expect(forwards([0xf2, 0, 0])).toBe(false); // song position
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
