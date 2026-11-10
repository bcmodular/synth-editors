// Listens to the SP-404's MIDI output (the input named SP-404, over the same USB cable) for pads played.

import { requestMidi } from "@synth-editors/midi";
import { useEffect, useState } from "react";
import type { PadMidiSettings } from "../core/padNotes";
import { applyPadNote, noActivity, padNoteOf, type PadActivity, type PadNote } from "./padHits";

const isSp404 = (input: MIDIInput) => /SP-404/i.test(input.name ?? "") && input.state === "connected";

interface Listeners {
  onNote: (note: PadNote) => void;
  onInput: (name: string | undefined) => void;
}

// Follow the SP-404's MIDI input as it comes and goes; returns a function that stops listening.
function listenForPadHits(access: MIDIAccess, settings: PadMidiSettings, { onNote, onInput }: Listeners): () => void {
  let input: MIDIInput | undefined;
  const onMessage = (e: MIDIMessageEvent) => {
    const note = e.data ? padNoteOf(e.data, settings) : undefined;
    if (note) onNote(note);
  };
  const attach = () => {
    const next = [...access.inputs.values()].find(isSp404);
    if (next === input) return;
    input?.removeEventListener("midimessage", onMessage);
    input = next;
    input?.addEventListener("midimessage", onMessage);
    onInput(input?.name ?? undefined);
  };
  access.addEventListener("statechange", attach);
  attach();
  return () => {
    access.removeEventListener("statechange", attach);
    input?.removeEventListener("midimessage", onMessage);
  };
}

export function usePadHits(settings: PadMidiSettings) {
  const [activity, setActivity] = useState<PadActivity>(noActivity);
  const [inputName, setInputName] = useState<string>();

  useEffect(() => {
    let stop: (() => void) | undefined;
    let cancelled = false;
    const listeners: Listeners = { onNote: (note) => setActivity((a) => applyPadNote(a, note)), onInput: setInputName };
    requestMidi().then((access) => {
      if (!cancelled) stop = listenForPadHits(access, settings, listeners);
    }, () => setInputName(undefined));
    return () => {
      cancelled = true;
      stop?.();
    };
  }, [settings]);

  return { activity, inputName };
}
