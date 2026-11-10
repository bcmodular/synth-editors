// Pads played, from the SP-404's MIDI output: a note-on for each pad hit and a note-off when it ends, on the notes
// of its MIDI mode (with SEQ Note Out and PAD Note Out on). Each hit bumps that pad's count, which restarts its
// flash on the desk; a pad is held from its note-on to its note-off.

import { padFromNote, type PadMidiSettings, type PadNumber } from "../core/padNotes";

// Pad → hit count (only pads hit at least once).
export type HitCounts = Readonly<Record<PadNumber, number>>;

export interface PadActivity {
  hits: HitCounts;
  held: readonly PadNumber[]; // note-on seen, note-off not yet
}

export const noActivity: PadActivity = { hits: {}, held: [] };

const NOTE_ON = 0x90;
const NOTE_OFF = 0x80;

export interface PadNote {
  pad: PadNumber;
  on: boolean;
}

// The pad a MIDI message starts or ends, if it's a note-on or note-off for one (note-on with velocity 0 is an off).
export function padNoteOf(data: ArrayLike<number>, settings: PadMidiSettings): PadNote | undefined {
  const [status = 0, note = 0, velocity = 0] = Array.from(data);
  const kind = status & 0xf0;
  if (kind !== NOTE_ON && kind !== NOTE_OFF) return undefined;
  const pad = padFromNote((status & 0x0f) + 1, note, settings);
  return pad === undefined ? undefined : { pad, on: kind === NOTE_ON && velocity > 0 };
}

export const countHit = (hits: HitCounts, pad: PadNumber): HitCounts => ({ ...hits, [pad]: (hits[pad] ?? 0) + 1 });

export function applyPadNote(a: PadActivity, { pad, on }: PadNote): PadActivity {
  const others = a.held.filter((p) => p !== pad);
  return on ? { hits: countHit(a.hits, pad), held: [...others, pad] } : { hits: a.hits, held: others };
}
