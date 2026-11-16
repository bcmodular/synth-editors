// A controller's own MIDI ports, found by name and followed as they come and go (the BCR2000, the Launchpad Pro, the
// Launchkey). With several matching ports, `rank` picks: the lowest rank, then the name.

import { requestMidi } from "@synth-editors/midi";
import { useEffect, useState } from "react";

export interface Ports {
  input?: MIDIInput;
  output?: MIDIOutput;
}

export interface PortMatch {
  name: RegExp;
  rank?: (name: string) => number;
}

const pick = <T extends MIDIPort>(ports: Iterable<T>, m: PortMatch): T | undefined => {
  const rank = (p: T) => m.rank?.(p.name ?? "") ?? 0;
  return [...ports]
    .filter((p) => m.name.test(p.name ?? "") && p.state === "connected")
    .sort((a, b) => rank(a) - rank(b) || (a.name ?? "").localeCompare(b.name ?? ""))[0];
};

export function usePortsNamed(match: PortMatch): Ports {
  const [ports, setPorts] = useState<Ports>({});
  useEffect(() => {
    let access: MIDIAccess | undefined;
    let cancelled = false;
    const update = () => {
      if (!access) return;
      const next = { input: pick(access.inputs.values(), match), output: pick(access.outputs.values(), match) };
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
  }, [match]);
  return ports;
}
