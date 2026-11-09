import { describe, expect, it } from "vitest";
import { DEFAULT_PAD_MIDI } from "../core/padNotes";
import { countHit, hitPad } from "./padHits";

describe("pad hits from MIDI", () => {
  it("maps a note-on to its pad (Mode B: channel 1, note 12 = A13)", () => {
    expect(hitPad([0x90, 12, 100], DEFAULT_PAD_MIDI)).toBe(12);
    expect(hitPad([0x91, 91, 1], DEFAULT_PAD_MIDI)).toBe(9 * 16 + 3); // J4 on channel 2
  });

  it("ignores note-on with velocity 0, note-off and other messages", () => {
    expect(hitPad([0x90, 12, 0], DEFAULT_PAD_MIDI)).toBeUndefined();
    expect(hitPad([0x80, 12, 64], DEFAULT_PAD_MIDI)).toBeUndefined();
    expect(hitPad([0xb0, 16, 64], DEFAULT_PAD_MIDI)).toBeUndefined();
    expect(hitPad([0xf8], DEFAULT_PAD_MIDI)).toBeUndefined();
  });

  it("counts hits per pad", () => {
    expect(countHit(countHit(countHit({}, 3), 3), 7)).toEqual({ 3: 2, 7: 1 });
  });
});
