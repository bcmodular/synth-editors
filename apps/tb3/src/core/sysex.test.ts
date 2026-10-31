import { describe, expect, it } from "vitest";
import { PATCH_BLOCKS, checksum, dt1, dt1Nibble16, parseDt1, rq1 } from "./sysex";

describe("TB-3 SysEx", () => {
  it("builds the LFO RQ1 with a Roland checksum", () => {
    // body 10 00 00 00 00 00 00 0D → sum 0x1D → checksum 0x63
    expect(rq1([0x10, 0x00, 0x00, 0x00], 0x0d)).toEqual([
      0xf0, 0x41, 0x10, 0x00, 0x00, 0x7b, 0x11, 0x10, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x0d, 0x63, 0xf7,
    ]);
  });

  it("checksum makes the body sum a multiple of 128", () => {
    const body = [0x10, 0x00, 0x0a, 0x00, 0x0f, 0x0f];
    expect((body.reduce((a, b) => a + b, 0) + checksum(body)) % 128).toBe(0);
  });

  it("nibble-packs 16-bit values", () => {
    const msg = dt1Nibble16([0x10, 0x00, 0x0a, 0x00], 0xab);
    expect(msg.slice(11, 13)).toEqual([0x0a, 0x0b]);
  });

  it("round-trips DT1 through the parser", () => {
    const msg = dt1([0x10, 0x00, 0x0c, 0x00], [1, 2, 3, 4, 5]);
    expect(parseDt1(msg)).toEqual({ addr: [0x10, 0x00, 0x0c, 0x00], data: [1, 2, 3, 4, 5], checksumOk: true });
  });

  it("flags a bad checksum", () => {
    const msg = dt1([0x10, 0x00, 0x0c, 0x00], [1, 2, 3]);
    msg[msg.length - 2] = (msg[msg.length - 2]! + 1) % 128;
    expect(parseDt1(msg)?.checksumOk).toBe(false);
  });

  it("defines all 11 patch blocks", () => {
    expect(PATCH_BLOCKS).toHaveLength(11);
  });
});
