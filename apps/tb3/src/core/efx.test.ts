import { describe, expect, it } from "vitest";
import { efxParamAt, efxTypes } from "./efx";
import type { EfxNum } from "./efx";

describe("EFX slots", () => {
  it.each([1, 2] as EfxNum[])("each EFX%i type keeps its values at offsets of its own", (efx) => {
    const offsets = efxTypes(efx).flatMap((t) => t.slots.filter((s) => s !== null).map((s) => s!.offset));
    expect(new Set(offsets).size).toBe(offsets.length);
  });

  it("finds a slot and its type by offset", () => {
    const p = efxParamAt(1, 0x04)!;
    expect(p.type.name).toBe("COMP");
    expect(p.typeIndex).toBe(1);
    expect(p.slot.name).toBe("THRESHOLD");
    expect(efxParamAt(1, 0x00)).toBeUndefined(); // the type byte
    expect(efxParamAt(2, 0x48)).toBeUndefined(); // REVERB's mode buttons, not a slot
  });
});
