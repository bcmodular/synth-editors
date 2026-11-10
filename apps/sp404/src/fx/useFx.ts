// The FX buses for the editor: state (kept between runs), and every change sent to the SP-404 as the fewest MIDI
// messages (a new effect sends its whole block; a knob sends one CC). Nothing comes back from the device, so
// RESEND pushes every bus again (after the SP-404 has been switched off, say).

import { useCallback, useEffect, useRef, useState } from "react";
import { BUSES, type Bus, type FxId } from "../core/fxTypes";
import { busDiffMessages, effectChangeMessages } from "../core/midi";
import { MidiSender } from "./midiSender";
import { choose, readFxState, setParam, toggleOn, type FxState } from "./fxState";
import { useMidiOut } from "./useMidiOut";

const KEY = "sp404.fx";

export function useFx() {
  const output = useMidiOut();
  const [state, setState] = useState<FxState>(() => readFxState(localStorage.getItem(KEY)));
  const current = useRef(state);
  const sender = useRef<MidiSender | null>(null);

  useEffect(() => {
    sender.current = output ? new MidiSender((m) => output.send(m)) : null;
    return () => sender.current?.stop();
  }, [output]);

  const apply = useCallback((bus: Bus, change: (s: FxState) => FxState) => {
    const before = current.current;
    const after = change(before);
    if (after === before) return;
    current.current = after;
    setState(after);
    localStorage.setItem(KEY, JSON.stringify(after));
    sender.current?.send(busDiffMessages(bus, before.buses[bus], after.buses[bus]));
  }, []);

  const chooseEffect = useCallback((bus: Bus, fxId: FxId) => apply(bus, (s) => choose(s, bus, fxId)), [apply]);
  const setValue = useCallback((bus: Bus, index: number, raw: number) =>
    apply(bus, (s) => setParam(s, bus, index, raw)), [apply]);
  const toggle = useCallback((bus: Bus) => apply(bus, (s) => toggleOn(s, bus)), [apply]);
  const resendAll = useCallback(() => {
    for (const bus of BUSES) sender.current?.send(effectChangeMessages(bus, current.current.buses[bus]));
  }, []);

  return { buses: state.buses, outputName: output?.name ?? undefined, chooseEffect, setValue, toggle, resendAll };
}

export type Fx = ReturnType<typeof useFx>;
