import { describe, expect, it } from "vitest";
import { effectById } from "../../core/fx";
import { VIEWS } from "./index";

// Each drawing is named after its effect; the registry must put it on that effect's id.
const VIEW_SUFFIX = /View$/;
const squash = (s: string) => s.toLowerCase().replace(/[^a-z]/g, ""); // letters only: "303 VinylSim" ~ VinylSim303

describe("VIEWS", () => {
  it("registers each drawing under its own effect", () => {
    for (const [id, view] of Object.entries(VIEWS)) {
      expect(view!.name, `effect ${id}'s view needs a name`).toMatch(/.View$/);
      const fx = effectById(Number(id))!;
      expect(squash(fx.name), `${view!.name} on effect ${id}`).toContain(squash(view!.name.replace(VIEW_SUFFIX, "")));
    }
  });
});

describe("VIEWS coverage", () => {
  it("has a drawing for every effect", () => {
    const missing = Array.from({ length: 46 }, (_, i) => i + 1).filter((id) => !VIEWS[id]);
    expect(missing).toEqual([]);
  });
});
