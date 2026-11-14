import { describe, expect, it } from "vitest";
import { demoPatch } from "./demoPatch";
import { fromStored, toStored } from "./sessionPersist";
import { freshSession, loadBuffer, storeSlot } from "./sessionState";

describe("session persistence", () => {
  it("round-trips the session, unsaved edits and buffer included", () => {
    const s = storeSlot(loadBuffer(freshSession(), demoPatch(), "demo.syx"), 3)!;
    const back = fromStored(JSON.parse(JSON.stringify(toStored({ ...s, active: null }))));
    expect(back).toEqual({ ...s, active: null });
  });

  it("reads sessions stored before the buffer had a name", () => {
    const stored = { ...toStored(freshSession()), bufferName: undefined };
    expect(fromStored(stored).bufferName).toBeNull();
  });

  it("fills out sessions stored with 16 slots to 64", () => {
    const stored = toStored(storeSlot(loadBuffer(freshSession(), demoPatch(), "demo.syx"), 3)!);
    const old = { ...stored, slots: stored.slots.slice(0, 16), savedKeys: stored.savedKeys.slice(0, 16) };
    const back = fromStored(old);
    expect(back.slots).toHaveLength(64);
    expect(back.savedKeys).toHaveLength(64);
    expect(back.slots[3]!.name).toBe("demo.syx");
    expect(back.slots[40]).toBeNull();
  });
});
