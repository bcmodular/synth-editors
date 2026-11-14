import { describe, expect, it } from "vitest";
import { addOffset, addrToInt, dt1, dt1Packets, intToAddr, nibbles, parseDt1, rq1 } from "./sysex";

describe("JV-2080 SysEx", () => {
  it("builds the manual's worked DT1 example (p.193)", () => {
    // Temporary Performance Common Reverb Type = DELAY
    expect(dt1([0x01, 0x00, 0x00, 0x28], [0x06])).toEqual([0xf0, 0x41, 0x10, 0x6a, 0x12, 0x01, 0x00, 0x00, 0x28, 0x06, 0x51, 0xf7]);
  });

  it("carries offsets past 127 into the next address byte", () => {
    expect(addOffset([0x03, 0x00, 0x10, 0x00], 128)).toEqual([0x03, 0x00, 0x11, 0x00]);
    expect(addOffset([0x03, 0x00, 0x10, 0x00], 0x51)).toEqual([0x03, 0x00, 0x10, 0x51]);
    expect(intToAddr(addrToInt([0x11, 0x7f, 0x16, 0x7f]))).toEqual([0x11, 0x7f, 0x16, 0x7f]);
  });

  it("encodes RQ1 sizes 7 bits per byte", () => {
    const tone = rq1([0x03, 0x00, 0x10, 0x00], 129);
    expect(tone.slice(9, 13)).toEqual([0x00, 0x00, 0x01, 0x01]);
    const common = rq1([0x03, 0x00, 0x00, 0x00], 74);
    expect(common.slice(9, 13)).toEqual([0x00, 0x00, 0x00, 0x4a]);
    // checksum makes address + size + checksum a multiple of 128
    expect([...common.slice(5, 14)].reduce((a, b) => a + b, 0) % 128).toBe(0);
  });

  it("splits a 129-byte tone into a 128-byte and a 1-byte packet", () => {
    const data = Array.from({ length: 129 }, (_, i) => i % 128);
    const packets = dt1Packets([0x03, 0x00, 0x12, 0x00], data);
    expect(packets).toHaveLength(2);
    const [a, b] = packets.map((p) => parseDt1(p)!);
    expect(a!.addr).toEqual([0x03, 0x00, 0x12, 0x00]);
    expect(a!.data).toHaveLength(128);
    expect(b!.addr).toEqual([0x03, 0x00, 0x13, 0x00]);
    expect(b!.data).toEqual([0]);
    expect(a!.checksumOk && b!.checksumOk).toBe(true);
  });

  it("parses DT1s from any device ID and rejects other messages", () => {
    const msg = dt1([0x03, 0x00, 0x00, 0x2e], [100], 0x13);
    expect(parseDt1(msg)).toMatchObject({ device: 0x13, data: [100], checksumOk: true });
    const bad = [...msg];
    bad[9] = 99;
    expect(parseDt1(bad)?.checksumOk).toBe(false);
    expect(parseDt1(rq1([0x03, 0x00, 0x00, 0x00], 74))).toBeUndefined();
    expect(parseDt1([0xf0, 0x41, 0x10, 0x7b, 0x12, 0, 0, 0, 0, 1, 0x7f, 0xf7])).toBeUndefined();
  });

  it("splits two-byte values into nibbles, high first", () => {
    expect(nibbles(0xab)).toEqual([0x0a, 0x0b]);
    expect(nibbles(254)).toEqual([0x0f, 0x0e]);
  });
});
