import { describe, expect, it } from "vitest";
import { lfoSample, lfoShape } from "./lfoShape";
import type { LfoShapeInput } from "./lfoShape";

const base: LfoShapeInput = { saw: 0, sqr: 0, tri: 0, sin: 0, sh: 0, rate: 0, delay: 0, cvOffset: 0 };

describe("lfoShape", () => {
  it("is flat when every level is zero", () => {
    expect(lfoShape(base, 32).every((y) => y === 0)).toBe(true);
  });

  it("sums wave levels", () => {
    // At t = 0.25 with one cycle: saw = −0.5, sqr = +1, tri = 0, sin = +1.
    const all = { ...base, saw: 127, sqr: 127, tri: 127, sin: 127 };
    expect(lfoSample(all, 0.25)).toBeCloseTo(-0.5 + 1 + 0 + 1);
    expect(lfoSample({ ...base, sqr: 127 }, 0.25)).toBeCloseTo(1);
    expect(lfoSample({ ...base, sqr: 127 }, 0.75)).toBeCloseTo(-1);
  });

  it("ramps in over the delay", () => {
    const p = { ...base, sqr: 127, delay: 127 }; // ramp ends at t = 0.5
    expect(lfoSample(p, 0)).toBe(0);
    expect(lfoSample(p, 0.1)).toBeCloseTo(0.2);
    expect(lfoSample(p, 0.25)).toBeCloseTo(0.5);
  });

  it("has a deterministic sample-and-hold sequence", () => {
    const p = { ...base, sh: 127, rate: 127 };
    expect(lfoShape(p, 64)).toEqual(lfoShape(p, 64));
    expect(lfoSample(p, 0.01)).toBeCloseTo(0.6);
  });

  it("normalises loud mixes to ±1 but leaves quiet ones alone", () => {
    const loud = lfoShape({ ...base, sqr: 127, sin: 127 }, 200);
    expect(Math.max(...loud.map(Math.abs))).toBeCloseTo(1);
    const quiet = lfoShape({ ...base, sqr: 32 }, 200);
    expect(Math.max(...quiet)).toBeCloseTo(32 / 127);
  });
});
