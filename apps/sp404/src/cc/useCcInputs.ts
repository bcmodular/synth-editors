// Every CC from the controllers CC learn listens to, as they come and go. The SP-404, the BCR2000 and the Launchpad
// Pro have their own mappings, so their ports aren't listened to.

import { useEffect, useRef } from "react";
import { requestMidi } from "@synth-editors/midi";

const NOT_LEARNABLE = /SP-404|BCR\s?2000|Launchpad/i;

export interface CcMessage {
  channel: number; // 1–16
  cc: number;
  value: number;
}

// A control change, if that's what the bytes are.
function ccOf(d: Uint8Array | null): CcMessage | undefined {
  if (!d || (d[0]! & 0xf0) !== 0xb0) return undefined;
  return { channel: (d[0]! & 0x0f) + 1, cc: d[1]!, value: d[2]! };
}

// Every CC from the learnable inputs, as they come and go.
export function useCcInputs(onCc: (m: CcMessage) => void) {
  const latest = useRef(onCc);
  latest.current = onCc;
  useEffect(() => {
    let access: MIDIAccess | undefined;
    let cancelled = false;
    const listening = new Set<MIDIInput>();
    const onMessage = (e: MIDIMessageEvent) => {
      const m = ccOf(e.data);
      if (m) latest.current(m);
    };
    const fresh = (input: MIDIInput) => !listening.has(input) && !NOT_LEARNABLE.test(input.name ?? "");
    const update = () => {
      for (const input of [...(access?.inputs.values() ?? [])].filter(fresh)) {
        input.addEventListener("midimessage", onMessage);
        listening.add(input);
      }
    };
    requestMidi().then((a) => {
      if (cancelled) return;
      access = a;
      a.addEventListener("statechange", update);
      update();
    }, () => undefined);
    return () => {
      cancelled = true;
      access?.removeEventListener("statechange", update);
      listening.forEach((i) => i.removeEventListener("midimessage", onMessage));
    };
  }, []);
}

