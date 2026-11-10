import { describe, expect, it } from "vitest";
import { DEFAULT_PAD_MIDI } from "../core/padNotes";
import { applyPadNote, countHit, noActivity, padNoteOf } from "./padHits";

describe("pads played, from MIDI", () => {
  it("maps a note-on to its pad (Mode B: channel 1, note 12 = A13)", () => {
    expect(padNoteOf([0x90, 12, 100], DEFAULT_PAD_MIDI)).toEqual({ pad: 12, on: true });
    expect(padNoteOf([0x91, 91, 1], DEFAULT_PAD_MIDI)).toEqual({ pad: 9 * 16 + 3, on: true }); // J4 on channel 2
  });

  it("reads note-off, and note-on with velocity 0, as the pad ending", () => {
    expect(padNoteOf([0x80, 12, 64], DEFAULT_PAD_MIDI)).toEqual({ pad: 12, on: false });
    expect(padNoteOf([0x90, 12, 0], DEFAULT_PAD_MIDI)).toEqual({ pad: 12, on: false });
  });

  it("ignores other messages", () => {
    expect(padNoteOf([0xb0, 16, 64], DEFAULT_PAD_MIDI)).toBeUndefined();
    expect(padNoteOf([0xf8], DEFAULT_PAD_MIDI)).toBeUndefined();
  });

  it("counts hits per pad", () => {
    expect(countHit(countHit(countHit({}, 3), 3), 7)).toEqual({ 3: 2, 7: 1 });
  });

  it("holds a pad from its note-on to its note-off", () => {
    const on = applyPadNote(applyPadNote(noActivity, { pad: 3, on: true }), { pad: 7, on: true });
    expect(on).toEqual({ hits: { 3: 1, 7: 1 }, held: [3, 7] });
    expect(applyPadNote(on, { pad: 3, on: false })).toEqual({ hits: { 3: 1, 7: 1 }, held: [7] });
  });
});
