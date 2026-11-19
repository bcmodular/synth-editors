import { describe, expect, it } from "vitest";
import { dbFromLevel, formatDb, levelFromDb, quantizeLevel, sameLevel } from "./faderLaw";

// Segment ends from Maillot's table: level ↔ dB.
const TABLE: [number, number][] = [
  [1, 10],
  [0.75, 0],
  [0.5, -10],
  [0.25, -30],
  [0.0625, -60],
  [0.03125, -75],
];

describe("fader law", () => {
  it.each(TABLE)("level %f is %f dB", (level, db) => {
    expect(dbFromLevel(level)).toBeCloseTo(db, 6);
    expect(levelFromDb(db)).toBeCloseTo(level, 6);
  });

  it("treats 0 as −∞ and clamps the ends", () => {
    expect(dbFromLevel(0)).toBe(-Infinity);
    expect(levelFromDb(-Infinity)).toBe(0);
    expect(levelFromDb(-120)).toBe(0);
    expect(levelFromDb(20)).toBe(1);
    expect(dbFromLevel(1.5)).toBe(10);
  });

  it("round-trips across every segment", () => {
    for (let db = -89; db <= 10; db += 0.5) expect(dbFromLevel(levelFromDb(db))).toBeCloseTo(db, 6);
  });

  it("quantizes to the desk's 1024 steps", () => {
    expect(quantizeLevel(0.75)).toBeCloseTo(767 / 1023, 9);
    expect(quantizeLevel(-1)).toBe(0);
    expect(quantizeLevel(2)).toBe(1);
    expect(sameLevel(0.75, 0.75 + 1 / 10000)).toBe(true);
    expect(sameLevel(0.75, 0.76)).toBe(false);
  });

  it("formats dB for people", () => {
    expect(formatDb(0.75)).toBe("0 dB");
    expect(formatDb(1)).toBe("+10 dB");
    expect(formatDb(0.5)).toBe("-10 dB");
    expect(formatDb(0)).toBe("-∞");
    expect(formatDb(quantizeLevel(0.75))).toBe("0 dB");
  });
});
