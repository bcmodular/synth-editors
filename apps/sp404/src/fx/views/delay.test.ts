import { describe, expect, it } from "vitest";
import { noteFraction, tapeMode } from "./delay";

const MODES = ["S", "M", "L", "S+M", "S+L", "M+L", "S+M+L"];

describe("delay drawings", () => {
  it("reads note values as fractions of a bar", () => {
    expect(noteFraction("1/4")).toBe(0.25);
    expect(noteFraction("1/8T")).toBeCloseTo(0.125 * (2 / 3));
    expect(noteFraction("1/8D")).toBeCloseTo(0.1875);
    expect(noteFraction("FLAT")).toBeUndefined();
  });

  it("finds the Tape Echo mode for a set of heads", () => {
    expect(tapeMode(new Set(["M", "S"]), MODES)).toBe(3);
    expect(tapeMode(new Set(["L", "M", "S"]), MODES)).toBe(6);
    expect(tapeMode(new Set(), MODES)).toBeUndefined();
  });
});
