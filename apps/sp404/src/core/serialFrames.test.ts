import { describe, expect, it } from "vitest";
import { longFrame, shortFrame, splitFrames } from "./serialFrames";

const hex = (bytes: Uint8Array) => Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join(" ");
const concat = (...parts: Uint8Array[]) => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  parts.reduce((at, p) => (out.set(p, at), at + p.length), 0);
  return out;
};

// Built from the header layout in SparkyMK2's 01-transport.md. TODO: check against bytes captured from the
// device in Phase 0 (a status poll and a set-level, host and device sides).
describe("building frames", () => {
  it("builds a 12-byte short frame with the length in byte 11", () => {
    expect(hex(shortFrame(5, [0xfe, 0x66, 0x00]))).toBe("12 60 e0 05 fe 66 00 00 00 00 00 03");
  });

  it("refuses short payloads that are empty or longer than 7 bytes", () => {
    expect(() => shortFrame(5, [])).toThrow(RangeError);
    expect(() => shortFrame(5, [1, 2, 3, 4, 5, 6, 7, 8])).toThrow(RangeError);
    expect(shortFrame(5, [1, 2, 3, 4, 5, 6, 7])[11]).toBe(7);
  });

  it("builds a long frame: 16-byte header with a u32 length, then the payload", () => {
    expect(hex(longFrame(5, [0x01, 0x69, 0x00]))).toBe("13 60 e0 05 00 00 00 00 00 00 00 00 03 00 00 00 01 69 00");
    expect(longFrame(5, new Uint8Array(327)).length).toBe(343);
  });
});

describe("splitting a received stream", () => {
  const status = shortFrame(5, [0xfe, 0x66, 0x00]);
  const block = longFrame(5, [0x1e, 0x02, 0x00, 0xaa]);

  it("decodes packed frames and their payloads", () => {
    const { frames, rest, skipped } = splitFrames(concat(status, block));
    expect(frames.map((f) => hex(f.payload))).toEqual(["fe 66 00", "1e 02 00 aa"]);
    expect(frames[0]).toMatchObject({ kind: 0x12, source: 0x60, destination: 0xe0, channel: 5 });
    expect(rest.length).toBe(0);
    expect(skipped).toBe(0);
  });

  it("keeps a partial frame for the next read", () => {
    const stream = concat(status, block);
    const first = splitFrames(stream.subarray(0, 20));
    expect(first.frames.length).toBe(1);
    const second = splitFrames(concat(first.rest, stream.subarray(20)));
    expect(second.frames.map((f) => hex(f.payload))).toEqual(["1e 02 00 aa"]);
  });

  it("waits for a whole long header before reading its length", () => {
    expect(splitFrames(block.subarray(0, 10))).toMatchObject({ frames: [], skipped: 0 });
  });

  it("skips bytes that can't start a frame", () => {
    const { frames, skipped } = splitFrames(concat(new Uint8Array([0x00, 0x7f]), status));
    expect(frames.length).toBe(1);
    expect(skipped).toBe(2);
  });

  it.todo("splits a stream captured from the device (status replies and a pad block)");
});
