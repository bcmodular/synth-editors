import { describe, expect, it } from "vitest";
import { EFX_TYPES } from "../../core/efx";
import { EFX_SPECS, panelParams } from "./specs";

describe("EFX view specs", () => {
  it("has one spec per type", () => {
    expect(EFX_SPECS).toHaveLength(EFX_TYPES.length);
  });

  it.each(EFX_TYPES.map((t, i) => [t.name, i] as const))("%s: every name a panel uses is one of the type's parameters", (_, i) => {
    const names = new Set(EFX_TYPES[i]!.params.map((p) => p.name));
    const used = EFX_SPECS[i]!.panels.flatMap(panelParams);
    expect(used.filter((n) => !names.has(n))).toEqual([]);
    expect(new Set(used).size).toBe(used.length); // no parameter drawn twice
  });

  it("collects the names a panel draws, not its labels or title", () => {
    expect(panelParams({ kind: "delay", title: "X", taps: [{ label: "L", time: "Delay Left", level: "Left Level" }], feedback: "Feedback" }))
      .toEqual(["Delay Left", "Left Level", "Feedback"]);
  });
});
