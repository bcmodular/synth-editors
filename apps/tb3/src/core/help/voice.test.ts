import { describe, expect, it } from "vitest";
import { paramById } from "../params";
import { share, strength, voiceIds, VOICE_FLOW } from "./voice";

describe("voice flow", () => {
  it("names only real parameters", () => {
    for (const id of voiceIds(VOICE_FLOW)) expect(() => paramById(id), id).not.toThrow();
  });

  it("has unique ids and stays inside its box", () => {
    const ids = [...VOICE_FLOW.blocks, ...VOICE_FLOW.edges].map((x) => x.id);
    expect(new Set(ids).size).toBe(ids.length);
    const points = [...VOICE_FLOW.edges.flatMap((e) => e.points), ...VOICE_FLOW.blocks.map((b) => b.at)];
    for (const [x, y] of points) {
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThanOrEqual(VOICE_FLOW.width);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThanOrEqual(VOICE_FLOW.height);
    }
  });

  it("covers every section", () => {
    const sections = new Set(VOICE_FLOW.blocks.map((b) => b.section));
    expect([...sections].sort()).toEqual(["dist", "efx1", "efx2", "lfo", "osc", "ring", "vca", "vcf", "xmod"]);
  });
});

describe("share", () => {
  it("is a share of full scale", () => {
    expect(share({ max: 255 }, 0)).toBe(0);
    expect(share({ max: 255 }, 255)).toBe(1);
  });

  it("measures a signed value from its centre, either way", () => {
    expect(share({ max: 127, center: 64 }, 64)).toBe(0);
    expect(share({ max: 127, center: 64 }, 0)).toBe(1);
    expect(share({ max: 127, center: 64 }, 96)).toBeCloseTo(0.5);
  });
});

describe("strength", () => {
  const amounts: Record<string, number> = { a: 0.2, b: 0.8, depth: 0.5 };
  const amount = (id: string) => amounts[id] ?? 0;

  it("takes the largest of its parameters, times another", () => {
    expect(strength({ ids: ["a", "b"] }, amount, () => true)).toBe(0.8);
    expect(strength({ ids: ["a", "b"], times: "depth" }, amount, () => true)).toBe(0.4);
  });

  it("is nothing while its switch is off", () => {
    expect(strength({ ids: ["b"], on: "sw" }, amount, () => false)).toBe(0);
  });
});
