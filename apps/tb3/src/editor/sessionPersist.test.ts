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
});
