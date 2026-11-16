import { describe, expect, it } from "vitest";
import { demoPatch } from "../editor/demoPatch";
import { setParam } from "./patch";
import { param } from "./paramValue";
import {
  emptySlots, nameFromPath, patchFromBytes, patchFromHex, patchToBytes, patchToHex, setFromJson, setToJson, SLOT_COUNT,
  slotFromKey, slotKey,
} from "./patchSet";

const A = setParam(demoPatch(), param("cutoff"), 33);

describe("patch files", () => {
  it("round-trip through .syx bytes and hex", () => {
    expect(patchFromBytes(patchToBytes(A))).toEqual(A);
    expect(patchFromHex(patchToHex(A))).toEqual(A);
  });

  it("refuse what isn't a whole JV patch", () => {
    expect(() => patchFromBytes([0xf0, 0x41, 0xf7])).toThrow(/no JV-2080 patch/);
    expect(() => patchFromBytes(patchToBytes(A).slice(0, 200))).toThrow(/incomplete/);
    expect(() => patchFromHex("abcd")).toThrow(/not a JV patch/);
  });

  it("name a patch after its file", () => expect(nameFromPath("Pads/Warm 1.syx")).toBe("Warm 1"));
});

describe("sets", () => {
  it("round-trip 16 slots, empty ones included", () => {
    const slots = emptySlots().map((_, i) => (i === 3 ? { name: "Warm", patch: A } : null));
    const back = setFromJson(setToJson(slots));
    expect(back).toHaveLength(SLOT_COUNT);
    expect(back[3]).toEqual({ name: "Warm", patch: A });
    expect(back.filter(Boolean)).toHaveLength(1);
  });

  it("refuse other files", () => {
    expect(() => setFromJson(JSON.stringify({ format: "tb3set", version: 2, slots: [] }))).toThrow(/not a JV-2080 set/);
    expect(() => setFromJson(JSON.stringify({ format: "jvset", version: 1, slots: [] }))).toThrow(/16 slots/);
  });

  it("key a slot by its name and bytes, and back", () => {
    const slot = { name: "Warm", patch: A };
    expect(slotFromKey(slotKey(slot))).toEqual(slot);
    expect(slotFromKey(slotKey(null))).toBeNull();
  });
});
