import { describe, expect, it } from "vitest";
import type { CcAssignment } from "@synth-editors/cc-learn";
import { controllerHandler } from "./ccControl";

function setup(current: number | null = 10, listening: string | null = null) {
  const writes: [string, number][] = [];
  const learned: [number, number][] = [];
  const assignments: CcAssignment[] = [{ channel: null, cc: 74, target: "param:cutoff:0", mode: "jump" }];
  const handle = controllerHandler({
    assignments: () => assignments,
    listening: () => listening,
    learned: (ch, cc) => learned.push([ch, cc]),
    read: () => ({ current, max: 127 }),
    write: (t, v) => writes.push([t, v]),
  });
  return { handle, writes, learned };
}

describe("the controller", () => {
  it("drives a learned CC's target", () => {
    const { handle, writes } = setup();
    handle([0xb2, 74, 100]);
    expect(writes).toEqual([["param:cutoff:0", 100]]);
  });

  it("ignores other CCs and other messages", () => {
    const { handle, writes } = setup();
    handle([0xb0, 71, 100]);
    handle([0x90, 60, 100]);
    expect(writes).toEqual([]);
  });

  it("doesn't move a target that can't move now (another EFX type)", () => {
    const { handle, writes } = setup(null);
    handle([0xb0, 74, 100]);
    expect(writes).toEqual([]);
  });

  it("while learning, the next CC is assigned, with its channel", () => {
    const { handle, writes, learned } = setup(10, "param:resonance:0");
    handle([0xb3, 20, 5]);
    expect(learned).toEqual([[4, 20]]);
    expect(writes).toEqual([]);
  });
});
