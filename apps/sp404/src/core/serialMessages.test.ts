import { describe, expect, it } from "vitest";
import { splitFrames, type Frame } from "./serialFrames";
import {
  bankVolumeFrame, mixChangeFrame, PAD_BLOCK_SIZE, parsePadBlock, parseStatus, readPadFrame, setParamFrame,
  statusFrame,
} from "./serialMessages";

const hex = (bytes: Uint8Array) => Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join(" ");
const payloadOf = (frame: Uint8Array) => hex(splitFrames(frame).frames[0]!.payload);
const reply = (payload: Uint8Array): Frame => ({ kind: 0x13, source: 0xe0, destination: 0x60, channel: 5, payload });

describe("requests", () => {
  it("sets a pad parameter: 01 id 00 target:u16 value:i32", () => {
    expect(payloadOf(setParamFrame(0, 0x69, 100))).toBe("01 69 00 00 00 64 00 00 00");
    expect(payloadOf(setParamFrame(159, 0x78, 64))).toBe("01 78 00 9f 00 40 00 00 00");
  });

  it("matches the set-parameter echo given in the notes (selected bank, global target)", () => {
    expect(payloadOf(setParamFrame(0xffff, 0x01, 0))).toBe("01 01 00 ff ff 00 00 00 00");
  });

  it("writes negative values as i32", () => {
    expect(payloadOf(setParamFrame(0, 0x73, -12))).toBe("01 73 00 00 00 f4 ff ff ff");
  });

  it("turns mixer changes into set-parameter frames", () => {
    expect(payloadOf(mixChangeFrame({ pad: 17, field: "muteGroup", value: 3 }))).toBe("01 6d 00 11 00 03 00 00 00");
    expect(payloadOf(mixChangeFrame({ pad: 17, field: "routing", value: 2 }))).toBe("01 7a 00 11 00 02 00 00 00");
    expect(payloadOf(mixChangeFrame({ pad: 17, field: "release", value: 90 }))).toBe("01 7f 00 11 00 5a 00 00 00");
  });

  it("sends bank volume to the global target, inverted", () => {
    expect(payloadOf(bankVolumeFrame(0, 100))).toBe("01 35 00 ff ff 1b 00 00 00");
    expect(payloadOf(bankVolumeFrame(9, 127))).toBe("01 3e 00 ff ff 00 00 00 00");
  });

  it("reads a pad and polls status with short frames", () => {
    expect(hex(readPadFrame(18))).toBe("12 60 e0 05 9e 12 00 00 00 00 00 03");
    expect(hex(statusFrame())).toBe("12 60 e0 05 fe 66 00 00 00 00 00 03");
  });

  it.todo("matches set-level, bank-volume and status frames captured from the device");
});

// A pad block laid out as 03-parameters.md describes it. TODO: replace with blocks captured from the device.
function padBlock(pad: number, fields: Record<number, number>, name: string): Uint8Array {
  const bytes = new Uint8Array(PAD_BLOCK_SIZE);
  const data = new DataView(bytes.buffer);
  bytes[0] = 0x1e;
  data.setUint16(1, pad, true);
  for (const [k, v] of Object.entries(fields)) data.setUint32(3 + 4 * Number(k), v, true);
  bytes.fill(0x20, 175, 198);
  bytes.set(Array.from(name, (c) => c.charCodeAt(0)), 175);
  return bytes;
}

describe("pad blocks", () => {
  it("reads the pad, name and mixer values", () => {
    const fields = { 0: 48000, 3: 110, 7: 2, 18: 40, 20: 1, 22: 5, 23: 100, 24: 64 };
    expect(parsePadBlock(reply(padBlock(33, fields, "KICK 01")))).toEqual({
      pad: 33,
      empty: false,
      name: "KICK 01",
      mix: { level: 110, muteGroup: 2, pan: 40, routing: 1, attack: 5, hold: 100, release: 64 },
    });
  });

  it("reads a 24-character name and marks an empty pad", () => {
    const block = parsePadBlock(reply(padBlock(0, {}, "ABCDEFGHIJKLMNOPQRSTUVW")));
    expect(block?.name).toBe("ABCDEFGHIJKLMNOPQRSTUVW");
    expect(block?.empty).toBe(true);
  });

  it("ignores other replies and short blocks", () => {
    expect(parsePadBlock(reply(padBlock(0, {}, "").subarray(0, 200)))).toBeUndefined();
    expect(parsePadBlock(reply(new Uint8Array(PAD_BLOCK_SIZE)))).toBeUndefined();
  });

  it.todo("parses blocks captured from the device: a loaded pad with known settings and an empty pad");
});

function statusReply(bytes: Record<number, number>, frames: number): Uint8Array {
  const out = new Uint8Array(19);
  out[0] = 0x7e;
  for (const [i, v] of Object.entries(bytes)) out[Number(i)] = v;
  new DataView(out.buffer).setUint32(8, frames, true);
  return out;
}

describe("status", () => {
  it("reads project, selected bank and pad, and the sounding pad's frame count", () => {
    expect(parseStatus(reply(statusReply({ 1: 5, 3: 2, 5: 7 }, 12345)))).toEqual({
      project: 5, selectedBank: 2, selectedPad: 7, playingFrames: 12345,
    });
  });

  it("reports nothing playing when the frame count is FFFFFFFF", () => {
    expect(parseStatus(reply(statusReply({}, 0xffffffff)))?.playingFrames).toBeUndefined();
  });

  it("ignores other replies and short ones", () => {
    expect(parseStatus(reply(new Uint8Array(10).fill(0x7e)))).toBeUndefined();
    expect(parseStatus(reply(new Uint8Array(19)))).toBeUndefined();
  });

  it.todo("parses status replies captured from the device (idle, pad selected, pad sounding)");
});
