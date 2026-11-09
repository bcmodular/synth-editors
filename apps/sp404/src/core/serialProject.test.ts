import { describe, expect, it } from "vitest";
import { bytes, PROJECT_SETTINGS } from "./serialCaptures";
import { longFrame, shortFrame, splitFrames, type Frame } from "./serialFrames";
import { parseProjectNotice, parseProjectSettings, projectSettingsFrame } from "./serialProject";

const hex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, "0")).join(" ");
const frameOf = (b: Uint8Array): Frame => splitFrames(b).frames[0]!;

describe("project settings", () => {
  it("requests a project's settings with FD project 00", () => {
    expect(hex(projectSettingsFrame(2))).toBe("12 60 e0 05 fd 02 00 00 00 00 00 03");
  });

  it("reads the name and bank volumes from a captured reply", () => {
    expect(parseProjectSettings(frameOf(bytes(PROJECT_SETTINGS)))).toEqual({
      project: 2,
      name: "PROJECT 3",
      bankVolumes: [127, 127, 127, 127, 127, 127, 127, 127, 127, 127],
    });
  });

  // Packing from the SparkyMK2 notes, not yet seen on the device.
  it("unpacks two inverted bank volumes per word", () => {
    const payload = new Uint8Array(147);
    payload[0] = 0x7d;
    const data = new DataView(payload.buffer);
    data.setUint32(3 + 4 * 23, (127 - 100) | ((127 - 64) << 16), true); // A = 100, B = 64
    data.setUint32(3 + 4 * 27, 127 << 16, true); // J = 0
    const volumes = parseProjectSettings(frameOf(longFrame(5, payload)))!.bankVolumes;
    expect(volumes).toEqual([100, 64, 127, 127, 127, 127, 127, 127, 127, 0]);
  });

  it("ignores other frames", () => {
    expect(parseProjectSettings(frameOf(longFrame(5, new Uint8Array(147))))).toBeUndefined();
  });
});

describe("project notice", () => {
  it("reads the project from 1A project", () => {
    expect(parseProjectNotice(frameOf(shortFrame(5, [0x1a, 0x04])))).toBe(4);
    expect(parseProjectNotice(frameOf(shortFrame(5, [0x1e, 0x04])))).toBeUndefined();
  });
});
