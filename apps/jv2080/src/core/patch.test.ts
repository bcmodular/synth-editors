import { describe, expect, it } from "vitest";
import {
  blockComplete, commonSummary, emptyPatch, PATCH_BLOCKS, patchComplete, patchToDt1s, placeDt1, receivedCount, toneSummary,
} from "./patch";
import { parseDt1 } from "./sysex";

function filledPatch() {
  const patch = emptyPatch();
  PATCH_BLOCKS.forEach((def, i) => {
    patch.blocks[i] = Array.from({ length: def.size }, (_, j) => (j * 7 + i) % 128);
    patch.received[i]!.fill(true);
  });
  return patch;
}

describe("temporary patch", () => {
  it("encodes to 9 DT1s and reassembles from them", () => {
    const source = filledPatch();
    const messages = patchToDt1s(source);
    expect(messages).toHaveLength(9);
    const copy = emptyPatch();
    for (const m of messages) {
      const dt = parseDt1(m)!;
      expect(placeDt1(copy, dt.addr, dt.data)).toBeDefined();
    }
    expect(patchComplete(copy)).toBe(true);
    expect(copy.blocks).toEqual(source.blocks);
  });

  it("tracks a tone that arrives in two packets", () => {
    const patch = emptyPatch();
    const [first, second] = patchToDt1s(filledPatch()).slice(1, 3).map((m) => parseDt1(m)!);
    expect(placeDt1(patch, first!.addr, first!.data)).toEqual({ block: 1, offset: 0, count: 128 });
    expect(blockComplete(patch, 1)).toBe(false);
    expect(receivedCount(patch, 1)).toBe(128);
    expect(placeDt1(patch, second!.addr, second!.data)).toEqual({ block: 1, offset: 128, count: 1 });
    expect(blockComplete(patch, 1)).toBe(true);
  });

  it("places a single-parameter DT1 and ignores addresses outside the patch", () => {
    const patch = emptyPatch();
    expect(placeDt1(patch, [0x03, 0x00, 0x14, 0x51], [99])).toEqual({ block: 3, offset: 0x51, count: 1 });
    expect(patch.blocks[3]![0x51]).toBe(99);
    expect(placeDt1(patch, [0x03, 0x00, 0x01, 0x00], [1])).toBeUndefined(); // between Common and Tone 1
    expect(placeDt1(patch, [0x00, 0x00, 0x00, 0x00], [1])).toBeUndefined();
  });

  it("decodes the name, wave number and reverb send", () => {
    const common = new Array<number>(74).fill(0);
    [..."Fat Strings "].forEach((c, i) => (common[i] = c.charCodeAt(0)));
    common[0x0c] = 13;
    common[0x2c] = 0x07;
    common[0x2d] = 0x08;
    expect(commonSummary(common)).toMatchObject({ name: "Fat Strings", efxType: 14, tempo: 120 });
    const tone = new Array<number>(129).fill(0);
    tone[0] = 1;
    tone[3] = 0x07;
    tone[4] = 0x05; // raw 117 → wave 118
    tone[128] = 58;
    expect(toneSummary(tone)).toMatchObject({ on: true, wave: 118, reverbSend: 58 });
  });
});
