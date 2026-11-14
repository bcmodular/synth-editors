import { describe, expect, it } from "vitest";
import { soloedSwitches, toggleSolo } from "./solo";

describe("solo", () => {
  const on = [true, true, false, true];

  it("leaves the switches alone with nothing soloed", () => {
    expect(soloedSwitches(on, new Set())).toEqual(on);
  });

  it("silences every tone that isn't soloed, and never turns on a tone that's off", () => {
    expect(soloedSwitches(on, new Set([1]))).toEqual([false, true, false, false]);
    expect(soloedSwitches(on, new Set([1, 2]))).toEqual([false, true, false, false]);
  });

  it("toggles a tone in and out", () => {
    const one = toggleSolo(new Set(), 3);
    expect([...one]).toEqual([3]);
    expect([...toggleSolo(one, 3)]).toEqual([]);
  });
});
