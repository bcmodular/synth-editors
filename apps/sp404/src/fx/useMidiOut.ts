// The SP-404's MIDI output port (named SP-404, over the USB cable), followed as it comes and goes.

import { requestMidi } from "@synth-editors/midi";
import { useEffect, useState } from "react";

const isSp404 = (port: MIDIOutput) => /SP-404/i.test(port.name ?? "") && port.state === "connected";

function follow(access: MIDIAccess, onOutput: (o: MIDIOutput | undefined) => void): () => void {
  const update = () => onOutput([...access.outputs.values()].find(isSp404));
  access.addEventListener("statechange", update);
  update();
  return () => access.removeEventListener("statechange", update);
}

export function useMidiOut(): MIDIOutput | undefined {
  const [output, setOutput] = useState<MIDIOutput>();
  useEffect(() => {
    let stop: (() => void) | undefined;
    let cancelled = false;
    requestMidi().then((access) => {
      if (!cancelled) stop = follow(access, setOutput);
    }, () => setOutput(undefined));
    return () => {
      cancelled = true;
      stop?.();
    };
  }, []);
  return output;
}
