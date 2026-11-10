import { describe, expect, it } from "vitest";
import { EFFECTS } from "../core/effects";
import { FX_LAYOUT } from "./fxLayout";

describe("FX_LAYOUT", () => {
  it("has one layout per effect, in id order, with a control per parameter", () => {
    expect(FX_LAYOUT).toHaveLength(EFFECTS.length);
    EFFECTS.forEach((fx, i) => {
      const layout = FX_LAYOUT[i]!;
      expect(layout.name.toLowerCase()).toBe(fx.name.toLowerCase());
      expect(layout.controls).toHaveLength(fx.params.length);
    });
  });

  it("marks the same SYNC switches as the effects table", () => {
    EFFECTS.forEach((fx, i) => {
      const fromLayout = FX_LAYOUT[i]!.controls.map((c) => c.kind === "sync");
      expect(fromLayout, fx.name).toEqual(fx.params.map((p) => Boolean(p.isSync)));
    });
  });

  it("gives discrete controls only to discrete parameters", () => {
    const discrete = new Set(["seg", "drop", "nv", "nv8", "big", "sync", "sk", "inview"]);
    EFFECTS.forEach((fx, i) => {
      FX_LAYOUT[i]!.controls.forEach((c, j) => {
        const p = fx.params[j]!;
        if (discrete.has(c.kind) || c.kind.startsWith("grid")) expect(p.starts, `${fx.name} ${p.label}`).toBeDefined();
      });
    });
  });
});
