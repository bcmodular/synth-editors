// MIDI notes the SP-404 MK2's pads answer to, so the mixer can show them (for sequencing from an OXI One).
// The SP-404 doesn't report its MIDI mode or offsets, so they come from the app's settings.
//
// From the MIDI note map in the SP-404MK2 Reference Manual (v5, July 2025), middle C = 60 = C4:
// - Mode A: one channel per bank (bank A = CH 1 … bank J = CH 10), every bank on notes 36–51.
// - Mode B: banks A–E on one channel and F–J on the next ("CH 1–9" / "CH 2–10" in the map, set by Pad MIDI
//   Channels), 16 notes per bank from note 12 (bank A pad 13 = C0) to 91, moved by Note offset.
// In both modes a bank's notes rise from the bottom row: pad 13 is the lowest, pad 4 the highest.

export const BANK_COUNT = 10;
export const PADS_PER_BANK = 16;
const PADS_PER_ROW = 4;
const ROWS = PADS_PER_BANK / PADS_PER_ROW;

const MODE_A_FIRST_NOTE = 36;
const MODE_B_FIRST_NOTE = 12;
const MODE_B_BANKS_PER_CHANNEL = 5;

export type MidiMode = "A" | "B";

export interface PadMidiSettings {
  mode: MidiMode;
  // Mode B only: the channel (1–9) for banks A–E; banks F–J use the next one.
  baseChannel: number;
  // Mode B only: added to every pad's note.
  noteOffset: number;
}

export const DEFAULT_PAD_MIDI: PadMidiSettings = { mode: "B", baseChannel: 1, noteOffset: 0 };

// A pad's note: channel 1–16 as shown on the device, note 0–127.
export interface PadNote {
  channel: number;
  note: number;
}

// A pad as the mixer numbers it: 0-based, bank × 16 + pad (pad 0 = pad 1, top left).
export type PadNumber = number;

// Position of a pad in its bank's note order: 0 for pad 13 (bottom left) up to 15 for pad 4 (top right).
function stepInBank(padInBank: number): number {
  const rowFromTop = Math.floor(padInBank / PADS_PER_ROW);
  return (ROWS - 1 - rowFromTop) * PADS_PER_ROW + (padInBank % PADS_PER_ROW);
}

function modeANote(bank: number, step: number): PadNote {
  return { channel: bank + 1, note: MODE_A_FIRST_NOTE + step };
}

function modeBNote(bank: number, step: number, settings: PadMidiSettings): PadNote {
  const group = Math.floor(bank / MODE_B_BANKS_PER_CHANNEL);
  const bankInGroup = bank % MODE_B_BANKS_PER_CHANNEL;
  const note = MODE_B_FIRST_NOTE + bankInGroup * PADS_PER_BANK + step + settings.noteOffset;
  return { channel: settings.baseChannel + group, note };
}

const inRange = (v: number, low: number, high: number): boolean => Number.isInteger(v) && v >= low && v <= high;
const isValid = ({ channel, note }: PadNote): boolean => inRange(channel, 1, 16) && inRange(note, 0, 127);

// The note a pad plays from, or undefined if the settings push it out of MIDI range.
export function padNote(pad: PadNumber, settings: PadMidiSettings = DEFAULT_PAD_MIDI): PadNote | undefined {
  if (!inRange(pad, 0, BANK_COUNT * PADS_PER_BANK - 1)) return undefined;
  const bank = Math.floor(pad / PADS_PER_BANK);
  const step = stepInBank(pad % PADS_PER_BANK);
  const result = settings.mode === "A" ? modeANote(bank, step) : modeBNote(bank, step, settings);
  return isValid(result) ? result : undefined;
}

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

// Note name with middle C (60) = C4, as in Roland's MIDI note map.
export function noteName(note: number): string {
  return `${NOTE_NAMES[note % 12]}${Math.floor(note / 12) - 1}`;
}
