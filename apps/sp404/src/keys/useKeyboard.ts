// The keyboard for the editor (docs/sp404-design.md › Controllers › Keyboard): what it's attached to (remembered),
// the Launchkey's keys, pads, encoders and pedal through the router, the encoders' rings following the attached bus,
// and notes to the SP-404.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BUSES, type Bus } from "../core/fxTypes";
import type { MidiMessage } from "../core/midi";
import type { Fx } from "../fx/useFx";
import { useMidiOut } from "../fx/useMidiOut";
import { usePortsNamed, type PortMatch } from "../midi/usePortsNamed";
import type { KeysTarget } from "./keyboard";
import { KeyRouter } from "./keyRouter";
import { encoderMessage, ENCODERS, parseLaunchkey } from "./launchkey";

// The Launchkey's MIDI port, not its DAW port.
export const LAUNCHKEY: PortMatch = { name: /Launchkey/i, rank: (name) => (/DAW/i.test(name) ? 1 : 0) };

const KEY = "sp404.keysTarget";

function readTarget(): KeysTarget | undefined {
  try {
    const t = JSON.parse(localStorage.getItem(KEY) ?? "null") as KeysTarget | null;
    if (t?.kind === "chromatic" || t?.kind === "soundGen") return t;
    return t?.kind === "bus" && BUSES.includes(t.bus) ? t : undefined;
  } catch {
    return undefined;
  }
}

function useTarget() {
  const [target, setShown] = useState<KeysTarget | undefined>(readTarget);
  const latest = useRef(target);
  const set = useCallback((t: KeysTarget | undefined) => {
    latest.current = t;
    localStorage.setItem(KEY, JSON.stringify(t ?? null));
    setShown(t);
  }, []);
  return { target, latest, set };
}

// The encoders' rings show the attached bus's values; only changes are sent.
function useRings(out: MIDIOutput | undefined, values: readonly number[] | undefined) {
  const sent = useRef<(number | undefined)[]>([]);
  useEffect(() => void (sent.current = []), [out]);
  useEffect(() => {
    if (!out) return;
    for (let slot = 0; slot < ENCODERS; slot++) {
      const v = values?.[slot] ?? 0;
      if (sent.current[slot] === v) continue;
      out.send(encoderMessage(slot, v));
      sent.current[slot] = v;
    }
  });
}

export function useKeyboard(fx: Fx) {
  const sp404 = useMidiOut();
  const launchkey = usePortsNamed(LAUNCHKEY);
  const { target, latest, set } = useTarget();
  const [notes, setNotes] = useState<number[]>([]);
  const fxRef = useRef(fx);
  fxRef.current = fx;
  const out = useRef(sp404);
  out.current = sp404;

  const router = useMemo(() => {
    const r: KeyRouter = new KeyRouter({
      fx: () => fxRef.current,
      target: () => latest.current,
      play: (m: MidiMessage[]) => {
        m.forEach((msg) => out.current?.send(msg));
        setNotes(r.voices.notes());
      },
    });
    return r;
  }, [latest]);

  useEffect(() => {
    const input = launchkey.input;
    if (!input) return;
    const onMessage = (e: MIDIMessageEvent) => {
      const event = parseLaunchkey(e.data ?? []);
      if (event) router.event(event);
    };
    input.addEventListener("midimessage", onMessage);
    return () => input.removeEventListener("midimessage", onMessage);
  }, [launchkey.input, router]);

  const bus: Bus | undefined = target?.kind === "bus" ? target.bus : undefined;
  useRings(launchkey.output, bus === undefined ? undefined : fx.buses[bus].values);

  const attach = useCallback((t: KeysTarget | undefined) => {
    router.release();
    set(t);
  }, [router, set]);
  useEffect(() => () => router.release(), [router]); // nothing left sounding

  return { target, attach, router, notes, launchkey: launchkey.input?.name ?? undefined };
}

export type Keyboard = ReturnType<typeof useKeyboard>;
