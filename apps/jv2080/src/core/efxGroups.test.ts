import { describe, expect, it } from "vitest";
import { EFX_TYPES } from "./efx";
import { EFX_CELLS, EFX_GROUPS, efxGroupOf } from "./efxGroups";

describe("EFX groups", () => {
  it("place each of the 40 types exactly once, at most a row's worth per group", () => {
    const types = EFX_GROUPS.flatMap((g) => g.types.map((x) => x.type));
    expect([...types].sort((a, b) => a - b)).toEqual(EFX_TYPES.map((_, i) => i));
    for (const g of EFX_GROUPS) expect(g.types.length, g.name).toBeLessThanOrEqual(EFX_CELLS);
  });

  it("finds a type's group", () => {
    expect(efxGroupOf(23)?.name).toBe("Delay & reverb");
    expect(efxGroupOf(6)?.name).toBe("Modulators");
    expect(efxGroupOf(99)).toBeUndefined();
  });
});
