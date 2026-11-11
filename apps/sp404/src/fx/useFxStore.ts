// The FX state for the editor: loaded from the library file, saved back as it changes, and every change sent to the
// SP-404 as the fewest MIDI messages per bus (a new effect sends its whole block; a knob sends one CC).

import { useCallback, useEffect, useRef, useState } from "react";
import { BUSES } from "../core/fxTypes";
import { busDiffMessages, type MidiMessage } from "../core/midi";
import { readFxState, type FxState } from "./fxState";
import { libraryJson, loadLibrary, localLibrary, saveLibrary } from "./libraryFile";
import { MidiSender } from "./midiSender";
import { useMidiOut } from "./useMidiOut";

export type Change = (s: FxState) => FxState;

const diff = (before: FxState, after: FxState): MidiMessage[] =>
  BUSES.flatMap((bus) => {
    const [was, now] = [before.buses[bus], after.buses[bus]];
    return was === now ? [] : busDiffMessages(bus, was, now);
  });

// A paced sender for the SP-404's MIDI output, while it's connected.
function useSender(output: MIDIOutput | undefined) {
  const sender = useRef<MidiSender | null>(null);
  useEffect(() => {
    sender.current = output ? new MidiSender((m) => output.send(m)) : null;
    return () => sender.current?.stop();
  }, [output]);
  return sender;
}

// The library file, once read at launch: it wins over localStorage. Nothing is sent (the device's state is
// unknown either way).
function useLibraryLoad(onLoad: (s: FxState) => void) {
  useEffect(() => {
    let cancelled = false;
    void loadLibrary().then((json) => {
      if (!cancelled && json !== null) onLoad(readFxState(json));
    });
    return () => void (cancelled = true);
  }, [onLoad]);
}

export function useFxStore() {
  const output = useMidiOut();
  const [state, setState] = useState<FxState>(() => readFxState(localLibrary()));
  const current = useRef(state);
  const sender = useSender(output);
  const loaded = useCallback((s: FxState) => {
    current.current = s;
    setState(s);
  }, []);
  useLibraryLoad(loaded);

  const set = useCallback((after: FxState, send: boolean) => {
    const before = current.current;
    if (after === before) return;
    current.current = after;
    setState(after);
    saveLibrary(libraryJson(after));
    if (send) sender.current?.send(diff(before, after));
  }, [sender]);

  // Apply a change and send what it changed.
  const apply = useCallback((change: Change) => set(change(current.current), true), [set]);
  // Replace the library without sending (an import).
  const replace = useCallback((next: FxState) => set(next, false), [set]);
  const send = useCallback((messages: MidiMessage[]) => sender.current?.send(messages), [sender]);

  return { state, current, apply, replace, send, outputName: output?.name ?? undefined };
}

export type FxStore = ReturnType<typeof useFxStore>;
