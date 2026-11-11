// MIDI clock for the tempo (docs/sp404-design.md › Scopes), from the input chosen in Settings or else the
// SP-404's own. The SP-404 passes on clock it receives on MIDI IN to USB with USB-MIDI Thru, or it can be routed to
// the computer some other way (an interface such as the H12MIDI-Pro) and chosen here.

import { requestMidi } from "@synth-editors/midi";
import { clockStep, newBeatClock } from "@synth-editors/audio";
import type { BeatClock } from "@synth-editors/audio";
import { useEffect, useRef, useState } from "react";
import type { RefObject } from "react";

const SP404_MIDI = /SP-404/i;
const FIRST_REALTIME = 0xf8;

const connected = (input: MIDIInput) => input.state === "connected";
const findInput = (access: MIDIAccess, chosen: string) => {
  const all = [...access.inputs.values()].filter(connected);
  return all.find((i) => i.name === chosen) ?? (chosen ? undefined : all.find((i) => SP404_MIDI.test(i.name ?? "")));
};
const namesOf = (access: MIDIAccess) => [...access.inputs.values()].filter(connected).map((i) => i.name ?? i.id);

interface Followers {
  clock: RefObject<BeatClock>;
  onInput: (name: string | undefined) => void;
  onNames: (names: string[]) => void;
}

// Real-time messages (clock, start, continue, stop) step the clock; everything else is ignored.
const clockListener = (clock: RefObject<BeatClock>) => (e: MIDIMessageEvent) => {
  const status = e.data?.[0] ?? 0;
  if (status >= FIRST_REALTIME) clock.current = clockStep(clock.current, status, e.timeStamp || performance.now());
};

// Follow the chosen input as ports come and go; returns a function that stops listening.
function followClock(access: MIDIAccess, chosen: string, { clock, onInput, onNames }: Followers): () => void {
  let input: MIDIInput | undefined;
  const onMessage = clockListener(clock);
  const attach = () => {
    onNames(namesOf(access));
    const next = findInput(access, chosen);
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

export function useBeatClock(chosen: string) {
  const clock: RefObject<BeatClock> = useRef(newBeatClock());
  const [inputName, setInputName] = useState<string>();
  const [midiInputs, setMidiInputs] = useState<string[]>([]);
  useEffect(() => {
    let stop: (() => void) | undefined;
    let cancelled = false;
    clock.current = newBeatClock();
    const followers: Followers = { clock, onInput: setInputName, onNames: setMidiInputs };
    requestMidi().then((access) => {
      if (!cancelled) stop = followClock(access, chosen, followers);
    }, () => setInputName(undefined));
    return () => {
      cancelled = true;
      stop?.();
    };
  }, [chosen]);
  return { clock, inputName, midiInputs };
}

export type ClockIn = ReturnType<typeof useBeatClock>;
