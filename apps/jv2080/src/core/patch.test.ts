import { describe, expect, it } from "vitest";
import {
  blockComplete, bufferToPatch, decodeSyx, emptyPatch, encodeSyx, getParam, PATCH_BLOCKS, paramAddress, paramDt1,
  patchComplete, patchName, patchToDt1s, placeDt1, receivedCount, setParam, setPatchName, type Patch,
} from "./patch";
import { param } from "./paramValue";
import { parseDt1 } from "./sysex";

function testPatch(): Patch {
  return PATCH_BLOCKS.map((def, i) => Array.from({ length: def.size }, (_, j) => (j * 7 + i) % 128));
}

describe("collecting a patch", () => {
  it("reassembles the 9 DT1s it encodes to", () => {
    const source = testPatch();
    const messages = patchToDt1s(source);
    expect(messages).toHaveLength(9);
    const buffer = emptyPatch();
    for (const m of messages) {
      const dt = parseDt1(m)!;
      expect(placeDt1(buffer, dt.addr, dt.data)).toBeDefined();
    }
    expect(patchComplete(buffer)).toBe(true);
    expect(bufferToPatch(buffer)).toEqual(source);
  });

  it("tracks a tone that arrives in two packets", () => {
    const buffer = emptyPatch();
    const [first, second] = patchToDt1s(testPatch()).slice(1, 3).map((m) => parseDt1(m)!);
    expect(placeDt1(buffer, first!.addr, first!.data)).toEqual({ block: 1, offset: 0, count: 128 });
    expect(blockComplete(buffer, 1)).toBe(false);
    expect(receivedCount(buffer, 1)).toBe(128);
    expect(bufferToPatch(buffer)).toBeUndefined();
    expect(placeDt1(buffer, second!.addr, second!.data)).toEqual({ block: 1, offset: 128, count: 1 });
    expect(blockComplete(buffer, 1)).toBe(true);
  });

  it("places a whole tone sent as one 129-byte DT1, as the JV does", () => {
    const buffer = emptyPatch();
    const tone = testPatch()[2]!;
    expect(placeDt1(buffer, PATCH_BLOCKS[2]!.addr, tone)).toEqual({ block: 2, offset: 0, count: 129 });
    expect(blockComplete(buffer, 2)).toBe(true);
  });

  it("ignores addresses outside the patch", () => {
    const buffer = emptyPatch();
    expect(placeDt1(buffer, [0x03, 0x00, 0x14, 0x51], [99])).toEqual({ block: 3, offset: 0x51, count: 1 });
    expect(placeDt1(buffer, [0x03, 0x00, 0x01, 0x00], [1])).toBeUndefined(); // between Common and Tone 1
    expect(placeDt1(buffer, [0x00, 0x00, 0x00, 0x00], [1])).toBeUndefined();
  });
});

describe(".syx", () => {
  it("round-trips a patch", () => {
    const patch = testPatch();
    const bytes = encodeSyx(patch);
    expect(bytes).toHaveLength(590 + 9 * 11);
    expect(decodeSyx(bytes)).toEqual({ patch });
  });

  it("reads another device ID and ignores other messages", () => {
    const patch = testPatch();
    const other = [0xf0, 0x7e, 0x7f, 0x06, 0x01, 0xf7];
    expect(decodeSyx([...other, ...encodeSyx(patch, 0x13)])).toEqual({ patch });
  });

  it("reports missing blocks, bad checksums and files with no patch", () => {
    const messages = patchToDt1s(testPatch());
    expect(decodeSyx(messages.slice(0, 8).flat())).toEqual({ error: "incomplete" });
    const bad = messages.map((m, i) => (i === 3 ? m.map((b, j) => (j === m.length - 2 ? b ^ 1 : b)) : m));
    expect(decodeSyx(bad.flat())).toEqual({ error: "checksum" });
    expect(decodeSyx([0xf0, 0x41, 0x10, 0x16, 0x12, 0xf7])).toEqual({ error: "no-patch" });
  });
});

describe("parameters", () => {
  it("reads and writes a tone parameter in the chosen tone only", () => {
    const cutoff = param("cutoff");
    const patch = setParam(testPatch(), cutoff, 99, 2);
    expect(getParam(patch, cutoff, 2)).toBe(99);
    expect(getParam(patch, cutoff, 1)).toBe(getParam(testPatch(), cutoff, 1));
  });

  it("clamps to the parameter's range", () => {
    const octave = param("octaveShift");
    expect(getParam(setParam(testPatch(), octave, 9), octave)).toBe(6);
    expect(getParam(setParam(testPatch(), octave, -2), octave)).toBe(0);
  });

  it("writes two-byte values as nibbles", () => {
    const wave = param("waveNumber");
    const patch = setParam(testPatch(), wave, 200, 0);
    expect(patch[1]!.slice(3, 5)).toEqual([0x0c, 0x08]);
    expect(getParam(patch, wave, 0)).toBe(200);
    expect(getParam(setParam(testPatch(), param("tempo"), 120), param("tempo"))).toBe(120);
  });

  it("addresses Reverb Send with the carry into the next address byte", () => {
    expect(paramAddress(param("reverbSend"), 0)).toEqual([0x03, 0x00, 0x11, 0x00]);
    expect(paramAddress(param("cutoff"), 3)).toEqual([0x03, 0x00, 0x16, 0x51]);
    expect(paramDt1(param("reverbSend"), 127, 0)).toEqual([0xf0, 0x41, 0x10, 0x6a, 0x12, 0x03, 0x00, 0x11, 0x00, 0x7f, 0x6d, 0xf7]);
    expect(paramDt1(param("tempo"), 120)).toEqual([0xf0, 0x41, 0x10, 0x6a, 0x12, 0x03, 0x00, 0x00, 0x2c, 0x07, 0x08, 0x42, 0xf7]);
  });

  it("names: reads, pads, truncates and replaces unsendable characters", () => {
    const named = setPatchName(testPatch(), "Fat Strings");
    expect(patchName(named)).toBe("Fat Strings");
    expect(named[0]!.slice(0, 12)).toEqual([..."Fat Strings "].map((c) => c.charCodeAt(0)));
    expect(patchName(setPatchName(testPatch(), "A very long patch name"))).toBe("A very long");
    expect(patchName(setPatchName(testPatch(), "Café~"))).toBe("Caf");
  });
});
