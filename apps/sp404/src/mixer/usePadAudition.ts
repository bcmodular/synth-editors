// Auditioning pads from the desk: pressing a pad's number sends its note on to the SP-404 over USB MIDI, and
// letting go sends the note off, so gated and looped pads stop as they do on the device. Notes follow the pad MIDI
// settings, as the note labels do.

import { useEffect, useMemo, useRef } from "react";
import { noteOffMessage, noteOnMessage, padNote, type PadMidiSettings } from "../core/padNotes";
import { useMidiOut } from "../fx/useMidiOut";

export interface Audition {
  press: (pad: number) => void;
  release: (pad: number) => void;
}

export function usePadAudition(midi: PadMidiSettings): Audition {
  const output = useMidiOut();
  const latest = useRef({ output, midi });
  latest.current = { output, midi };
  const held = useRef(new Map<number, number[]>()); // pad → the note off to send

  const audition = useMemo<Audition>(() => ({
    press: (pad) => {
      const { output: out, midi: settings } = latest.current;
      const note = held.current.has(pad) ? undefined : padNote(pad, settings);
      if (!note) return;
      out?.send(noteOnMessage(note));
      held.current.set(pad, noteOffMessage(note));
    },
    release: (pad) => {
      const off = held.current.get(pad);
      if (!off) return;
      held.current.delete(pad);
      latest.current.output?.send(off);
    },
  }), []);

  // Nothing is left sounding when the desk goes away.
  useEffect(() => () => [...held.current.keys()].forEach(audition.release), [audition]);
  return audition;
}
