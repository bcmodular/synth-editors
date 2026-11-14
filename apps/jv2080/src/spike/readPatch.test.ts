import { describe, expect, it } from "vitest";
import { emptyPatch, PATCH_BLOCKS, patchComplete, patchName } from "../core/patch";
import { addrToInt, dt1Packets, type Address } from "../core/sysex";
import { readPatch } from "./readPatch";
import type { SysexListener } from "./useJvLink";

// A fake JV: answers each RQ1 with that block's bytes, split into ≤ 128-byte DT1s, asynchronously.
function fakeJv(blocks: number[][], answer = true) {
  const listeners = new Set<SysexListener>();
  const notes: string[] = [];
  return {
    notes,
    device: 0x10,
    note: (t: string) => void notes.push(t),
    subscribe: (fn: SysexListener) => {
      listeners.add(fn);
      return () => void listeners.delete(fn);
    },
    send: (bytes: number[]) => {
      if (!answer || bytes[4] !== 0x11) return;
      const at = addrToInt(bytes.slice(5, 9));
      const i = PATCH_BLOCKS.findIndex((b) => addrToInt(b.addr) === at);
      for (const p of dt1Packets(bytes.slice(5, 9) as unknown as Address, blocks[i]!)) {
        setTimeout(() => listeners.forEach((fn) => fn(p, 0)), 1);
      }
    },
  };
}

describe("readPatch", () => {
  it("reads all five blocks, tones in two packets each", async () => {
    const blocks = PATCH_BLOCKS.map((b) => new Array<number>(b.size).fill(5));
    [..."Test Patch  "].forEach((c, i) => (blocks[0]![i] = c.charCodeAt(0)));
    const jv = fakeJv(blocks);
    const patch = emptyPatch();
    expect(await readPatch(jv, patch, () => {})).toBe(true);
    expect(patchComplete(patch)).toBe(true);
    expect(patchName(patch.blocks[0]!)).toBe("Test Patch");
    expect(jv.notes.filter((n) => n.includes("2 packet(s)"))).toHaveLength(4);
  });

  it("stops at the first block that doesn't arrive", { timeout: 3000 }, async () => {
    const jv = fakeJv([], false);
    expect(await readPatch(jv, emptyPatch(), () => {})).toBe(false);
    expect(jv.notes).toEqual([expect.stringMatching(/^Common: 0\/74 bytes in 0 packet/)]);
  });
});
