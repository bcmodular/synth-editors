// Pad hits from the SP-404's MIDI output: it sends a note-on (no note-off) for each pad played, on the notes of
// its MIDI mode. Each hit bumps that pad's count, which restarts its flash on the desk.

import { padFromNote, type PadMidiSettings, type PadNumber } from "../core/padNotes";

// Pad → hit count (only pads hit at least once).
export type HitCounts = Readonly<Record<PadNumber, number>>;

const NOTE_ON = 0x90;

// The pad a MIDI message plays, if it's a note-on for one.
export function hitPad(data: ArrayLike<number>, settings: PadMidiSettings): PadNumber | undefined {
  const [status = 0, note = 0, velocity = 0] = Array.from(data);
  if ((status & 0xf0) !== NOTE_ON || velocity === 0) return undefined;
  return padFromNote((status & 0x0f) + 1, note, settings);
}

export const countHit = (hits: HitCounts, pad: PadNumber): HitCounts => ({ ...hits, [pad]: (hits[pad] ?? 0) + 1 });
