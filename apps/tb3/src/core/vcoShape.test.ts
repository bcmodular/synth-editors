import { describe, expect, it } from "vitest";
import { vcoShape } from "./vcoShape";
import type { VcoShapeInput } from "./vcoShape";

const base: VcoShapeInput = { saw: 0, sqr: 0, sin: 0, white: 0, pink: 0, ring: 0, sawTune: 0, sqrTune: 0, sinTune: 0 };

describe("vcoShape", () => {
  it("is flat when every level is zero", () => {
    expect(vcoShape(base, 32).every((y) => y === 0)).toBe(true);
  });

  it("draws two cycles of a single wave at full scale", () => {
    const ys = vcoShape({ ...base, sqr: 127 }, 8); // 2 cycles over 8 steps
    expect(ys).toEqual([1, 1, -1, -1, 1, 1, -1, -1, 1]);
  });

  it("scales a quiet mix down, not up", () => {
    const ys = vcoShape({ ...base, sqr: 64 }, 8);
    expect(ys[0]).toBeCloseTo(64 / 127);
  });

  it("draws a wave an octave up per 24 tuning steps, relative to the lowest one playing", () => {
    const ys = vcoShape({ ...base, saw: 1, sqr: 127, sqrTune: 24 }, 8); // sqr: 4 cycles over 8 steps
    expect(ys.slice(0, 4).map(Math.sign)).toEqual([1, -1, 1, -1]);
  });

  it("keeps a single detuned wave visible", () => {
    expect(vcoShape({ ...base, saw: 127, sawTune: -127 }, 8)).toEqual(vcoShape({ ...base, saw: 127 }, 8));
  });

  it("caps the spread between waves at three octaves", () => {
    const far = vcoShape({ ...base, saw: 127, sqr: 127, sawTune: -127 }, 64);
    const capped = vcoShape({ ...base, saw: 127, sqr: 127, sawTune: -72 }, 64);
    expect(far).toEqual(capped);
  });

  it("normalises a loud mix to ±1 and repeats its noise", () => {
    const p = { ...base, saw: 127, sqr: 127, white: 127, pink: 127 };
    const ys = vcoShape(p, 120);
    expect(Math.max(...ys.map(Math.abs))).toBeCloseTo(1);
    expect(vcoShape(p, 120)).toEqual(ys);
  });
});
