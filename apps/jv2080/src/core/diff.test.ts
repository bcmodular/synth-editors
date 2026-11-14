import { describe, expect, it } from "vitest";
import { diffPatch, diffRuns } from "./diff";
import { decodeSyx, emptyPatch, PATCH_BLOCKS, placeDt1, setParam, type Patch } from "./patch";
import { param } from "./paramValue";
import { parseDt1 } from "./sysex";

const base: Patch = PATCH_BLOCKS.map((def) => new Array<number>(def.size).fill(0));

// Applies DT1s to a copy of a patch, as the JV would.
function apply(patch: Patch, messages: number[][]): Patch {
  const buffer = emptyPatch();
  buffer.blocks = patch.map((b) => [...b]);
  for (const m of messages) {
    const dt = parseDt1(m)!;
    placeDt1(buffer, dt.addr, dt.data);
  }
  return buffer.blocks;
}

describe("diffPatch", () => {
  it("sends nothing for an unchanged patch", () => {
    expect(diffPatch(base, base)).toEqual([]);
  });

  it("sends one byte for one edit, at the carried address for Reverb Send", () => {
    const edited = setParam(base, param("reverbSend"), 90, 1);
    expect(diffRuns(base, edited)).toEqual([{ block: 2, offset: 128, length: 1 }]);
    expect(parseDt1(diffPatch(base, edited)[0]!)!.addr).toEqual([0x03, 0x00, 0x13, 0x00]);
  });

  it("merges nearby edits into one message and keeps distant ones apart", () => {
    let edited = setParam(base, param("cutoff"), 10, 0); // 0x51
    edited = setParam(edited, param("resonance"), 20, 0); // 0x53
    edited = setParam(edited, param("toneLevel"), 30, 0); // 0x65
    expect(diffRuns(base, edited)).toEqual([{ block: 1, offset: 0x51, length: 3 }, { block: 1, offset: 0x65, length: 1 }]);
  });

  it("sends both nibbles when only one half of a two-byte value changes", () => {
    const edited = setParam(base, param("waveNumber"), 5, 3); // 00 05: only the low nibble differs
    expect(diffRuns(base, edited)).toEqual([{ block: 4, offset: 3, length: 2 }]);
  });

  it("splits a run longer than 128 bytes and produces a patch equal to the target", () => {
    const target: Patch = base.map((b, i) => b.map((_, j) => (i + j) % 100 + 1));
    const messages = diffPatch(base, target);
    expect(messages).toHaveLength(9);
    expect(messages.every((m) => m.length - 11 <= 128)).toBe(true);
    expect(apply(base, messages)).toEqual(target);
    expect(decodeSyx(messages.flat())).toEqual({ patch: target });
  });
});
