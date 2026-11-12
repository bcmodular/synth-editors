import { describe, expect, it } from "vitest";
import type { CcAssignment } from "@synth-editors/cc-learn";
import { launchkeyHandler } from "./launchkeyControl";
import type { KeysDeps, TargetValue } from "./launchkeyControl";

function setup(assignments: CcAssignment[], values: Record<string, TargetValue> = {}) {
  const sent: number[][] = [];
  const written: [string, number][] = [];
  const learned: [number, number][] = [];
  let listening: string | null = null;
  const deps: KeysDeps = {
    tb3Channel: () => 2,
    send: (m) => sent.push(m),
    assignments: () => assignments,
    listening: () => listening,
    learned: (ch, cc) => learned.push([ch, cc]),
    read: (t) => values[t] ?? { current: null, max: 127 },
    write: (t, v) => written.push([t, v]),
  };
  return { sent, written, learned, listen: (t: string | null) => (listening = t), handle: launchkeyHandler(deps) };
}

describe("launchkeyHandler", () => {
  it("passes notes, pitch bend and unassigned CCs to the TB-3's channel", () => {
    const k = setup([]);
    k.handle([0x90, 60, 100]);
    k.handle([0x80, 60, 0]);
    k.handle([0xe3, 0, 80]);
    k.handle([0xb0, 64, 127]);
    k.handle([0xf8]); // clock: dropped
    expect(k.sent).toEqual([
      [0x91, 60, 100],
      [0x81, 60, 0],
      [0xe1, 0, 80],
      [0xb1, 64, 127],
    ]);
  });

  it("drives an assigned target by its mode, keeping pickup state", () => {
    const k = setup(
      [
        { channel: null, cc: 74, target: "param:vcf_cutoff", mode: "pickup" },
        { channel: 1, cc: 17, target: "tb3cc:17", mode: "jump" },
      ],
      { "param:vcf_cutoff": { current: 128, max: 255 } },
    );
    k.handle([0xb0, 74, 10]); // far from 128: ignored
    k.handle([0xb0, 74, 64]); // 129: picked up
    k.handle([0xb0, 17, 90]);
    k.handle([0xb1, 17, 90]); // channel 2: not assigned, passed on
    expect(k.written).toEqual([
      ["param:vcf_cutoff", 129],
      ["tb3cc:17", 90],
    ]);
    expect(k.sent).toEqual([[0xb1, 17, 90]]);
  });

  it("while learning, the next CC is assigned and not passed on", () => {
    const k = setup([]);
    k.listen("param:accent");
    k.handle([0xb4, 21, 5]);
    expect(k.learned).toEqual([[5, 21]]);
    expect(k.sent).toEqual([]);
  });
});
