import { describe, expect, it } from "vitest";
import { BANKS, patchLabel, programChange } from "./banks";
import { applyDt1, PATCH_BLOCKS, type Patch } from "./patch";

describe("banks", () => {
  it("selects PR-B 042 on channel 6", () => {
    const prB = BANKS.find((b) => b.name === "PR-B")!;
    expect(programChange(prB, 42, 5)).toEqual([[0xb5, 0, 81], [0xb5, 32, 1], [0xc5, 41]]);
    expect(patchLabel(prB, 42)).toBe("PR-B 042");
  });
});

describe("applyDt1", () => {
  const blank: Patch = PATCH_BLOCKS.map((b) => new Array<number>(b.size).fill(0));

  it("returns a new patch with the bytes placed, leaving the original alone", () => {
    const next = applyDt1(blank, [0x03, 0x00, 0x12, 0x51], [99]);
    expect(next[2]![0x51]).toBe(99);
    expect(blank[2]![0x51]).toBe(0);
  });

  it("returns the same patch for an address outside it", () => {
    expect(applyDt1(blank, [0x00, 0x00, 0x00, 0x00], [1])).toBe(blank);
  });
});
