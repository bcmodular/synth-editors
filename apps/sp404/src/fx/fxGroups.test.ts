import { describe, expect, it } from "vitest";
import { EFFECTS } from "../core/fx";
import { FX_GROUPS } from "./fxGroups";

describe("effect groups", () => {
  it("fit the Launchpad's 8 × 8: 8 rows of at most 8 effects", () => {
    expect(FX_GROUPS).toHaveLength(8);
    for (const g of FX_GROUPS) expect(g.effects.length, g.name).toBeLessThanOrEqual(8);
  });

  it("hold every effect once", () => {
    const ids = FX_GROUPS.flatMap((g) => g.effects.map((fx) => fx.id));
    expect([...ids].sort((a, b) => a - b)).toEqual(EFFECTS.map((fx) => fx.id).sort((a, b) => a - b));
  });

  it("give each group its own colour and Launchpad colour", () => {
    expect(new Set(FX_GROUPS.map((g) => g.colour)).size).toBe(8);
    expect(new Set(FX_GROUPS.map((g) => g.launchpad)).size).toBe(8);
  });
});
