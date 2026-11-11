import { describe, expect, it } from "vitest";
import type { Frame } from "./serialFrames";
import { cleanName, isRenameEcho, PAD_NAME, renameFrame } from "./serialNames";

const payloadOf = (frame: Uint8Array) => Array.from(frame.subarray(16), (b) => b.toString(16).padStart(2, "0"));
const reply = (payload: number[]): Frame => ({ kind: 0x13, source: 0xe0, destination: 0x60, channel: 5, payload: Uint8Array.from(payload) });

describe("serialNames", () => {
  it("renames a pad: 02 pad:u16, then the name space padded to 23 characters", () => {
    const payload = payloadOf(renameFrame({ pad: 17, name: "Kick 2" }));
    expect(payload.slice(0, 9).join(" ")).toBe("02 11 00 4b 69 63 6b 20 32");
    expect(payload).toHaveLength(3 + 23);
    expect(payload.at(-1)).toBe("20");
  });

  it("renames the project: 35 project, then the name space padded to 32 characters", () => {
    const payload = payloadOf(renameFrame({ project: 5, name: "SET" }));
    expect(payload.slice(0, 5).join(" ")).toBe("35 05 53 45 54");
    expect(payload).toHaveLength(2 + 32);
  });

  it("knows the device's echo of a rename by its command and target", () => {
    expect(isRenameEcho(reply([0x02, 0x11, 0x00, 0x41]), { pad: 17, name: "A" })).toBe(true);
    expect(isRenameEcho(reply([0x02, 0x12, 0x00, 0x41]), { pad: 17, name: "A" })).toBe(false);
    expect(isRenameEcho(reply([0x35, 0x05, 0x41]), { project: 5, name: "A" })).toBe(true);
    expect(isRenameEcho(reply([0x01, 0x05, 0x41]), { project: 5, name: "A" })).toBe(false);
  });

  it("keeps names to printable ASCII, trimmed and cut to length", () => {
    expect(cleanName("  Caf\u00e9\tbeat  ", PAD_NAME)).toBe("Cafbeat");
    expect(cleanName("A".repeat(30), PAD_NAME)).toHaveLength(23);
  });
});
