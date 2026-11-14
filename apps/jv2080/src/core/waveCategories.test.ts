import { describe, expect, it } from "vitest";
import { ALL_WAVES, categoriesOf, findWaves, WAVE_CATEGORIES, waveCategory } from "./waveCategories";

describe("wave categories", () => {
  it("put every one of the 448 waves in exactly one category", () => {
    expect(ALL_WAVES).toHaveLength(448);
    const notOne = ALL_WAVES.filter((w) => categoriesOf(w.group, w.number).length !== 1);
    expect(notOne.map((w) => `${w.group} ${w.number + 1} ${w.name}`)).toEqual([]);
    for (const category of WAVE_CATEGORIES) expect(ALL_WAVES.some((w) => w.category === category), category).toBe(true);
  });

  it("files waves where you'd look for them", () => {
    expect(waveCategory("INT-A", 0)).toBe("Piano"); // Ac Piano1 A
    expect(waveCategory("INT-A", 17)).toBe("E.Piano & Clav"); // SA Rhodes 2A
    expect(waveCategory("INT-A", 127)).toBe("Bass"); // Fingerd Bs C
    expect(waveCategory("INT-B", 0)).toBe("Bell & Mallet"); // Kalimba
    expect(waveCategory("INT-B", 45)).toBe("Basic waves"); // Sine
    expect(waveCategory("INT-B", 83)).toBe("Drums"); // 808 Kick
    expect(waveCategory("INT-B", 170)).toBe("Loops"); // Loop 1
  });

  it("marks the reversed waves", () => {
    expect(ALL_WAVES.filter((w) => w.reversed)).toHaveLength(46);
  });

  it("finds waves by the words of their name, in any category or one", () => {
    expect(findWaves("ac piano").map((w) => w.name)).toContain("Ac Piano1 A");
    expect(findWaves("rhodes").map((w) => w.name)).toEqual(
      ["SA Rhodes 1A", "SA Rhodes 1B", "SA Rhodes 1C", "SA Rhodes 2A", "SA Rhodes 2B", "SA Rhodes 2C"]);
    expect(findWaves("kick", "Drums").every((w) => w.category === "Drums")).toBe(true);
    expect(findWaves("", "Loops")).toHaveLength(7);
  });
});
