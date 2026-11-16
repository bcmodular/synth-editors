import { describe, expect, it, vi } from "vitest";
import { getEfxType, setEfxType } from "../core/patch";
import { demoPatch } from "./demoPatch";
import { defaultModeFor, efxOf, efxTarget, modesFor, targetLabel } from "./ccTargets";
import { readTarget, writeTarget } from "./useLaunchkey";
import type { CcTargetsCtx } from "./useLaunchkey";

const COMP_THRESHOLD = efxTarget(1, 0x04);

describe("EFX targets", () => {
  it("name one parameter of one type", () => {
    expect(COMP_THRESHOLD).toBe("efx:1:4");
    expect(efxOf(COMP_THRESHOLD)!.slot.name).toBe("THRESHOLD");
    expect(targetLabel(COMP_THRESHOLD)).toBe("EFX1 COMP THRESHOLD");
    expect(targetLabel(efxTarget(2, 0x4e))).toBe("EFX2 REVERB EFX LVL");
    expect(efxOf("efx:3:4")).toBeNull();
    expect(efxOf("efx:1:0")).toBeNull(); // the type byte isn't a parameter
    expect(modesFor(COMP_THRESHOLD)).toEqual(["relative", "pickup", "jump"]);
    expect(defaultModeFor(COMP_THRESHOLD)).toBe("pickup");
  });
});

describe("EFX targets read and write", () => {
  const ctx = (typeIndex: number): CcTargetsCtx => ({
    patch: setEfxType(demoPatch(), 1, typeIndex),
    setParam: vi.fn(),
    setEfxByte: vi.fn(),
    tuning: 64,
    setTuning: vi.fn(),
    morph: null,
    setMorph: vi.fn(),
  });

  it("reads the byte, with the slot's range", () => {
    const c = ctx(1);
    expect(readTarget(c, COMP_THRESHOLD).max).toBe(40);
    expect(readTarget(c, COMP_THRESHOLD).current).not.toBeNull();
  });

  it("sets the byte while its type is selected, and leaves it alone otherwise", () => {
    const comp = ctx(1);
    expect(getEfxType(comp.patch!, 1)).toBe(1);
    writeTarget(comp, COMP_THRESHOLD, 30, vi.fn());
    expect(comp.setEfxByte).toHaveBeenCalledWith(1, 0x04, 30);
    const other = ctx(2);
    writeTarget(other, COMP_THRESHOLD, 30, vi.fn());
    expect(other.setEfxByte).not.toHaveBeenCalled();
  });
});
