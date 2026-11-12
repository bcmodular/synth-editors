import { describe, expect, it } from "vitest";
import { ledsRgb, nextProfile, padToSlot, parseLaunchpad, profileNamed, scaleRgb, slotToPad } from "./index";

describe("launchpad", () => {
  it("maps the top two rows to slots and back", () => {
    expect(padToSlot(81)).toBe(1);
    expect(padToSlot(78)).toBe(16);
    expect(padToSlot(61)).toBeUndefined();
    expect(padToSlot(89)).toBeUndefined(); // the right-hand side button
    for (let s = 1; s <= 16; s++) expect(padToSlot(slotToPad(s))).toBe(s);
  });

  it("parses pads, pressure, channel pressure and buttons", () => {
    expect(parseLaunchpad([0x90, 81, 100])).toEqual({ type: "pad", note: 81, velocity: 100 });
    expect(parseLaunchpad([0x80, 81, 64])).toEqual({ type: "pad", note: 81, velocity: 0 });
    expect(parseLaunchpad([0xa0, 81, 30])).toEqual({ type: "pressure", note: 81, value: 30 });
    expect(parseLaunchpad([0xd0, 55])).toEqual({ type: "channelPressure", value: 55 });
    expect(parseLaunchpad([0xb0, 50, 127])).toEqual({ type: "button", cc: 50, value: 127 });
    expect(parseLaunchpad([0xf8])).toBeUndefined();
  });

  it("sets several LEDs in one message, clamped to 0–63", () => {
    expect(ledsRgb([[81, [63, 0, 0]], [82, [70, 31.6, -1]]])).toEqual(
      [0xf0, 0x00, 0x20, 0x29, 0x02, 0x10, 0x0b, 81, 63, 0, 0, 82, 63, 32, 0, 0xf7],
    );
  });

  it("cycles brightness profiles and falls back to night", () => {
    expect(nextProfile("night")).toBe("normal");
    expect(nextProfile("day")).toBe("very dim");
    expect(profileNamed("bogus")).toBe("night");
    expect(profileNamed("day")).toBe("day");
    expect(scaleRgb([60, 30, 0], 0.5)).toEqual([30, 15, 0]);
  });
});
