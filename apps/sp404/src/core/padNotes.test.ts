import { describe, expect, it } from "vitest";
import { noteName, padFromNote, padNote, type PadMidiSettings } from "./padNotes";

// Pad number from bank letter and the pad's label on the device (1–16).
const pad = (bank: string, label: number) => (bank.charCodeAt(0) - 65) * 16 + label - 1;

const MODE_A: PadMidiSettings = { mode: "A", baseChannel: 1, noteOffset: 0 };
const MODE_B: PadMidiSettings = { mode: "B", baseChannel: 1, noteOffset: 0 };

describe("Mode A", () => {
  it("puts bank A on notes 36–51, rising from the bottom row (Roland note map)", () => {
    expect(padNote(pad("A", 13), MODE_A)).toEqual({ channel: 1, note: 36 });
    expect(padNote(pad("A", 16), MODE_A)).toEqual({ channel: 1, note: 39 });
    expect(padNote(pad("A", 9), MODE_A)).toEqual({ channel: 1, note: 40 });
    expect(padNote(pad("A", 5), MODE_A)).toEqual({ channel: 1, note: 44 });
    expect(padNote(pad("A", 1), MODE_A)).toEqual({ channel: 1, note: 48 });
    expect(padNote(pad("A", 4), MODE_A)).toEqual({ channel: 1, note: 51 });
  });

  it("gives each bank its own channel with the same notes", () => {
    expect(padNote(pad("B", 1), MODE_A)).toEqual({ channel: 2, note: 48 });
    expect(padNote(pad("J", 13), MODE_A)).toEqual({ channel: 10, note: 36 });
  });

  it("ignores the Mode B offsets", () => {
    expect(padNote(pad("C", 13), { mode: "A", baseChannel: 5, noteOffset: 20 })).toEqual({ channel: 3, note: 36 });
  });
});

describe("Mode B", () => {
  it("runs banks A–E up channel 1 from note 12 (Roland note map)", () => {
    expect(padNote(pad("A", 13), MODE_B)).toEqual({ channel: 1, note: 12 });
    expect(padNote(pad("A", 4), MODE_B)).toEqual({ channel: 1, note: 27 });
    expect(padNote(pad("B", 13), MODE_B)).toEqual({ channel: 1, note: 28 });
    expect(padNote(pad("D", 13), MODE_B)).toEqual({ channel: 1, note: 60 });
    expect(padNote(pad("E", 4), MODE_B)).toEqual({ channel: 1, note: 91 });
  });

  it("repeats the notes for banks F–J on the next channel", () => {
    expect(padNote(pad("F", 13), MODE_B)).toEqual({ channel: 2, note: 12 });
    expect(padNote(pad("H", 13), MODE_B)).toEqual({ channel: 2, note: 44 });
    expect(padNote(pad("J", 4), MODE_B)).toEqual({ channel: 2, note: 91 });
  });

  it("matches the user's Mode B sheet, which names notes an octave lower (C-1 = 12)", () => {
    const sheetName = (n: number) => noteName(n - 12);
    expect(sheetName(padNote(pad("A", 1))!.note)).toBe("C0");
    expect(sheetName(padNote(pad("C", 1))!.note)).toBe("G#2");
    expect(sheetName(padNote(pad("H", 16))!.note)).toBe("B1");
    expect(sheetName(padNote(pad("I", 3))!.note)).toBe("D4");
    expect(sheetName(padNote(pad("E", 13))!.note)).toBe("E4");
  });

  it("moves with Pad MIDI Channels and Note offset", () => {
    const settings: PadMidiSettings = { mode: "B", baseChannel: 9, noteOffset: 7 };
    expect(padNote(pad("A", 13), settings)).toEqual({ channel: 9, note: 19 });
    expect(padNote(pad("J", 13), settings)).toEqual({ channel: 10, note: 83 });
  });

  it("gives no note when an offset pushes a pad out of range", () => {
    expect(padNote(pad("E", 4), { mode: "B", baseChannel: 1, noteOffset: 40 })).toBeUndefined();
    expect(padNote(pad("A", 13), { mode: "B", baseChannel: 1, noteOffset: -13 })).toBeUndefined();
    expect(padNote(pad("F", 1), { mode: "B", baseChannel: 16, noteOffset: 0 })).toBeUndefined();
  });
});

describe("padNote and noteName", () => {
  it("rejects pads outside the ten banks", () => {
    expect(padNote(-1)).toBeUndefined();
    expect(padNote(160)).toBeUndefined();
    expect(padNote(1.5)).toBeUndefined();
  });

  it("names notes with middle C = C4", () => {
    expect(noteName(60)).toBe("C4");
    expect(noteName(12)).toBe("C0");
    expect(noteName(0)).toBe("C-1");
    expect(noteName(91)).toBe("G6");
  });
});

describe("padFromNote", () => {
  const settings: PadMidiSettings[] = [MODE_A, MODE_B, { mode: "B", baseChannel: 5, noteOffset: 9 }];

  it("finds the pad for every pad's own note, in each mode", () => {
    for (const s of settings) {
      for (let p = 0; p < 160; p++) {
        const n = padNote(p, s);
        if (n) expect(padFromNote(n.channel, n.note, s)).toBe(p);
      }
    }
  });

  it("knows the corners of the user's Mode B sheet", () => {
    expect(padFromNote(1, 12, MODE_B)).toBe(pad("A", 13));
    expect(padFromNote(1, 27, MODE_B)).toBe(pad("A", 4));
    expect(padFromNote(2, 91, MODE_B)).toBe(pad("J", 4));
  });

  it("ignores notes that aren't pads", () => {
    expect(padFromNote(1, 0, MODE_B)).toBeUndefined(); // EXT SOURCE
    expect(padFromNote(1, 92, MODE_B)).toBeUndefined();
    expect(padFromNote(3, 12, MODE_B)).toBeUndefined();
    expect(padFromNote(1, 35, MODE_A)).toBeUndefined(); // EXT SOURCE in Mode A
    expect(padFromNote(11, 36, MODE_A)).toBeUndefined();
  });
});
