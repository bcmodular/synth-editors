import { describe, expect, it } from "vitest";
import { FALL_DB_PER_S, HOLD_S, clearClip, formatDb, meterFraction, meterStep, silentMeter, toDb } from "./levelMeter";

describe("levelMeter", () => {
  it("reads silence as minus infinity", () => {
    const m = meterStep(silentMeter(), [0, 0, 0], 0.1);
    expect(m.db).toBe(-Infinity);
    expect(formatDb(m.db)).toBe("–");
  });

  it("rises at once to the peak of the frame, either polarity", () => {
    const m = meterStep(silentMeter(), [0.1, -0.5, 0.2], 0.1);
    expect(m.db).toBeCloseTo(toDb(0.5));
    expect(formatDb(m.db)).toBe("−6.0 dB");
  });

  it("falls at a steady rate after a peak", () => {
    let m = meterStep(silentMeter(), [0.5], 0);
    m = meterStep(m, [0], 0.5);
    expect(m.db).toBeCloseTo(toDb(0.5) - FALL_DB_PER_S * 0.5);
  });

  it("holds the highest peak for a while, then follows the level", () => {
    let m = meterStep(silentMeter(), [0.5], 0);
    m = meterStep(m, [0.1], 1);
    expect(m.holdDb).toBeCloseTo(toDb(0.5));
    m = meterStep(m, [0.1], HOLD_S + 0.1);
    expect(m.holdDb).toBeCloseTo(toDb(0.1));
  });

  it("latches the clip light and the highest peak until cleared", () => {
    let m = meterStep(silentMeter(), [1], 0);
    m = meterStep(m, [0.01], 5);
    expect(m.clipped).toBe(true);
    expect(m.maxDb).toBeCloseTo(0);
    m = clearClip(m);
    expect(m.clipped).toBe(false);
    expect(m.maxDb).toBe(-Infinity);
  });

  it("shows digital silence as a dash, not a tiny level", () => {
    expect(formatDb(toDb(1e-9))).toBe("–");
    expect(formatDb(-60)).toBe("−60.0 dB");
  });

  it("maps levels onto the bar between the floor and full scale", () => {
    expect(meterFraction(-Infinity)).toBe(0);
    expect(meterFraction(-48)).toBe(0);
    expect(meterFraction(-24)).toBe(0.5);
    expect(meterFraction(0)).toBe(1);
    expect(meterFraction(3)).toBe(1);
  });
});
