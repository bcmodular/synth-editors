import { describe, expect, it } from "vitest";
import { correlationOf, createCorrelation, pushCorrelation } from "./correlation";

const RATE = 48000;
const tone = (n: number, sign = 1, phase = 0) =>
  Float32Array.from({ length: n }, (_, i) => sign * Math.sin((2 * Math.PI * 440 * i) / RATE + phase));

describe("correlation", () => {
  it("is +1 for mono, −1 for out of phase, about 0 for a quarter-cycle shift", () => {
    const mono = createCorrelation(RATE);
    pushCorrelation(mono, tone(4800), tone(4800));
    expect(correlationOf(mono)).toBeCloseTo(1, 5);
    const flipped = createCorrelation(RATE);
    pushCorrelation(flipped, tone(4800), tone(4800, -1));
    expect(correlationOf(flipped)).toBeCloseTo(-1, 5);
    const shifted = createCorrelation(RATE);
    pushCorrelation(shifted, tone(4800), tone(4800, 1, Math.PI / 2));
    expect(Math.abs(correlationOf(shifted))).toBeLessThan(0.05);
  });

  it("is NaN in silence and forgets old frames", () => {
    const c = createCorrelation(RATE);
    expect(correlationOf(c)).toBeNaN();
    pushCorrelation(c, tone(4800), tone(4800, -1));
    for (let i = 0; i < 20; i++) pushCorrelation(c, tone(4800), tone(4800));
    expect(correlationOf(c)).toBeGreaterThan(0.99);
  });
});
