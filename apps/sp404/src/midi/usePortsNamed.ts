// The BCR2000's own MIDI ports (named BCR2000), followed as they come and go.

import { requestMidi } from "@synth-editors/midi";
import { useEffect, useState } from "react";

export interface Ports {
  input?: MIDIInput;
  output?: MIDIOutput;
}

const isBcr = (p: MIDIPort) => /BCR\s?2000/i.test(p.name ?? "") && p.state === "connected";
// The first BCR port by name (Port 1 when the BCR offers several).
const firstBcr = <T extends MIDIPort>(ports: Iterable<T>): T | undefined =>
  [...ports].filter(isBcr).sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""))[0];

export function useBcrPorts(): Ports {
  const [ports, setPorts] = useState<Ports>({});
  useEffect(() => {
    let access: MIDIAccess | undefined;
    let cancelled = false;
    const update = () => {
      if (!access) return;
      const next = { input: firstBcr(access.inputs.values()), output: firstBcr(access.outputs.values()) };
      setPorts((was) => (was.input === next.input && was.output === next.output ? was : next));
    };
    requestMidi().then((a) => {
      if (cancelled) return;
      access = a;
      a.addEventListener("statechange", update);
      update();
    }, () => setPorts({}));
    return () => {
      cancelled = true;
      access?.removeEventListener("statechange", update);
    };
  }, []);
  return ports;
}
