// The FX buses for the editor (docs/sp404-design.md › FX): the state and its MIDI (useFxStore), the library's playing
// modes (useFxPlay), and the plain edits: choosing an effect, a parameter, ON/OFF (and the FX grab, on while held),
// Exclude tuning. Nothing comes back from the device, so SYNC pushes a bus again and SYNC ALL FX every bus (after the
// SP-404 has been switched off, say).

import { useCallback } from "react";
import { BUSES, type Bus, type FxId } from "../core/fxTypes";
import { effectChangeMessages } from "../core/midi";
import { setExclude } from "./fxLibrary";
import { choose, readFxState, setOn, setParam, toggleOn } from "./fxState";
import { useFxPlay } from "./useFxPlay";
import { useFxStore } from "./useFxStore";

export function useFx() {
  const store = useFxStore();
  const play = useFxPlay(store);
  const { apply } = store;

  const chooseEffect = useCallback((bus: Bus, fxId: FxId) => {
    play.endMorph(bus); // a morph's target is a preset of the old effect
    apply((s) => choose(s, bus, fxId));
  }, [apply, play]);
  const setValue = useCallback((bus: Bus, index: number, raw: number) =>
    apply((s) => setParam(s, bus, index, raw)), [apply]);
  const toggle = useCallback((bus: Bus) => apply((s) => toggleOn(s, bus)), [apply]);
  const toggleExclude = useCallback((bus: Bus) => apply((s) => setExclude(s, bus, !s.exclude[bus])), [apply]);
  const hold = useCallback((bus: Bus, down: boolean) => apply((s) => setOn(s, bus, down)), [apply]);
  const sync = useCallback((bus: Bus) => store.send(effectChangeMessages(bus, store.current.current.buses[bus])), [store]);
  const syncAll = useCallback(() => BUSES.forEach(sync), [sync]);
  // Replace the library from an imported file's text; the buses keep what they're playing.
  const importJson = useCallback((json: string) => {
    const imported = readFxState(json);
    store.replace({ ...imported, buses: store.current.current.buses });
  }, [store]);

  return {
    state: store.state, buses: store.state.buses, outputName: store.outputName, play, chooseEffect, setValue, toggle,
    hold, toggleExclude, sync, syncAll, importJson,
  };
}

export type Fx = ReturnType<typeof useFx>;
