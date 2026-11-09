// Listens to the SP-404's MIDI output (the input named SP-404, over the same USB cable) for pad hits.

import { requestMidi } from "@synth-editors/midi";
import { useEffect, useState } from "react";
import type { PadMidiSettings, PadNumber } from "../core/padNotes";
import { countHit, hitPad, type HitCounts } from "./padHits";

const isSp404 = (input: MIDIInput) => /SP-404/i.test(input.name ?? "") && input.state === "connected";

interface Listeners {
  onHit: (pad: PadNumber) => void;
  onInput: (name: string | undefined) => void;
}

// Follow the SP-404's MIDI input as it comes and goes; returns a function that stops listening.
function listenForPadHits(access: MIDIAccess, settings: PadMidiSettings, { onHit, onInput }: Listeners): () => void {
  let input: MIDIInput | undefined;
  const onMessage = (e: MIDIMessageEvent) => {
    const pad = e.data ? hitPad(e.data, settings) : undefined;
    if (pad !== undefined) onHit(pad);
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
  const [hits, setHits] = useState<HitCounts>({});
  const [inputName, setInputName] = useState<string>();

  useEffect(() => {
    let stop: (() => void) | undefined;
    let cancelled = false;
    const listeners: Listeners = { onHit: (pad) => setHits((h) => countHit(h, pad)), onInput: setInputName };
    requestMidi().then((access) => {
      if (!cancelled) stop = listenForPadHits(access, settings, listeners);
    }, () => setInputName(undefined));
    return () => {
      cancelled = true;
      stop?.();
    };
  }, [settings]);

  return { hits, inputName };
}
