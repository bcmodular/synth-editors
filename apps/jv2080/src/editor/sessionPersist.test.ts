import { describe, expect, it } from "vitest";
import { demoPatch } from "./demoPatch";
import { fromStored, toStored } from "./sessionPersist";
import { freshSession, loadBuffer, storeSlot } from "./sessionState";

describe("session persistence", () => {
  it("round-trips the slots, the active slot and the buffer", () => {
    const s = loadBuffer(storeSlot(loadBuffer(freshSession(), demoPatch(), "A.syx"), 3)!, demoPatch(), "B");
    const back = fromStored(JSON.parse(JSON.stringify(toStored(s))));
    expect(back.slots).toEqual(s.slots);
    expect(back.active).toBeNull();
    expect(back.buffer).toEqual(s.buffer);
    expect(back.bufferName).toBe("B");
  });

  it("refuses stored data that isn't a JV session", () => {
    expect(() => fromStored({ ...toStored(freshSession()), slots: [] })).toThrow();
  });
});
