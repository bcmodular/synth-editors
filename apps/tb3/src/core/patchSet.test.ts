import { describe, expect, it } from "vitest";
import { patchToSysex } from "./patch";
import type { Patch } from "./patch";
import {
  emptySlots,
  nameFromPath,
  patchFromBytes,
  patchFromHex,
  patchToBytes,
  patchToHex,
  setFromJson,
  setToJson,
  slotKey,
} from "./patchSet";
import { PATCH_BLOCKS, addrKey } from "./sysex";

function synthetic(seed = 0): Patch {
  const blocks: Patch["blocks"] = {};
  PATCH_BLOCKS.forEach((b, bi) => {
    blocks[addrKey(b.addr)] = Array.from({ length: b.size }, (_, i) => (i * 7 + bi + seed) % 16);
  });
  return { blocks };
}

describe("patch files", () => {
  it("writes a .syx as the 11 DT1 blocks back to back and reads it back", () => {
    const p = synthetic(3);
    const bytes = patchToBytes(p);
    expect(Array.from(bytes)).toEqual(patchToSysex(p).flat());
    expect(patchFromBytes(bytes)).toEqual(p);
  });

  it("round-trips through hex", () => {
    const p = synthetic(5);
    expect(patchToHex(p)).toMatch(/^f0/);
    expect(patchFromHex(patchToHex(p))).toEqual(p);
  });

  it("rejects bytes that aren't a full patch", () => {
    expect(() => patchFromBytes(patchToBytes(synthetic()).slice(0, 40))).toThrow();
    expect(() => patchFromHex("zz")).toThrow(/hex/);
  });

  it("names a patch after its file", () => {
    expect(nameFromPath("Bass/Acid 1.syx")).toBe("Acid 1");
    expect(nameFromPath("Lead.v2.syx")).toBe("Lead.v2");
  });
});

describe("sets", () => {
  it("round-trips 16 slots, empty ones included", () => {
    const slots = [...emptySlots()];
    slots[0] = { name: "Acid 1", patch: synthetic(1) };
    slots[15] = { name: "Last", patch: synthetic(2) };
    const back = setFromJson(setToJson(slots));
    expect(back).toHaveLength(16);
    expect(back[0]).toEqual(slots[0]);
    expect(back[15]).toEqual(slots[15]);
    expect(back.slice(1, 15).every((s) => s === null)).toBe(true);
  });

  it("rejects other JSON and wrong shapes", () => {
    expect(() => setFromJson('{"format":"other"}')).toThrow(/not a TB-3 set/);
    expect(() => setFromJson('{"format":"tb3set","version":2,"slots":[]}')).toThrow(/version/);
    expect(() => setFromJson('{"format":"tb3set","version":1,"slots":[]}')).toThrow(/16 slots/);
  });

  it("keys a slot by name and content", () => {
    const a = { name: "A", patch: synthetic(1) };
    expect(slotKey(a)).toBe(slotKey({ name: "A", patch: synthetic(1) }));
    expect(slotKey(a)).not.toBe(slotKey({ name: "B", patch: synthetic(1) }));
    expect(slotKey(a)).not.toBe(slotKey({ name: "A", patch: synthetic(2) }));
    expect(slotKey(null)).toBe("");
  });
});
