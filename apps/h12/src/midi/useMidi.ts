// One Web MIDI access for the whole app, and a signature of the connected ports that changes when ports come or go
// (settled, since a device's ports appear one by one when it is plugged in).

import { requestMidi } from "@synth-editors/midi";
import { useEffect, useState } from "react";

const SETTLE_MS = 300;

export interface Midi {
  access?: MIDIAccess;
  error?: string;
  ports: string; // changes whenever the set of connected ports does
}

const signature = (access: MIDIAccess) =>
  [...access.inputs.values(), ...access.outputs.values()]
    .filter((p) => p.state === "connected")
    .map((p) => `${p.type}:${p.name}`)
    .sort()
    .join("|");

// The connected ports whose name matches.
export const portsNamed = <T extends MIDIPort>(ports: Iterable<T>, name: RegExp): T[] =>
  [...ports].filter((p) => name.test(p.name ?? "") && p.state === "connected");

export function useMidi(): Midi {
  const [midi, setMidi] = useState<Midi>({ ports: "" });
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let unfollow = () => undefined as void;
    requestMidi().then((access) => {
      if (cancelled) return;
      const follow = () => {
        clearTimeout(timer);
        timer = setTimeout(() => setMidi({ access, ports: signature(access) }), SETTLE_MS);
      };
      access.addEventListener("statechange", follow);
      unfollow = () => access.removeEventListener("statechange", follow);
      setMidi({ access, ports: signature(access) });
    }, (e: unknown) => cancelled || setMidi({ ports: "", error: e instanceof Error ? e.message : String(e) }));
    return () => {
      cancelled = true;
      clearTimeout(timer);
      unfollow();
    };
  }, []);
  return midi;
}
