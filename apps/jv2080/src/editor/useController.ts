// The controller on CTRL IN (MIDI settings), wired to the learned CCs (ccControl.ts) and the patch in the editor.
// It listens alongside anything else on the same port, so the controller can share an interface with the JV.
import { findInputByName } from "@synth-editors/midi";
import { useEffect, useMemo, useRef } from "react";
import type { Patch } from "../core/patch";
import type { JvLink } from "../link/useJvLink";
import { controllerHandler } from "./ccControl";
import { readTarget, writeTarget, type SetValue } from "./ccTargets";
import type { CcLearn } from "./useCcLearn";

// `patchNow` reads the active patch as it is this moment, so CCs arriving faster than the screen redraws build on each
// other (an encoder turned quickly).
export function useController(link: JvLink, learn: CcLearn, patchNow: () => Patch | null, setValue: SetValue) {
  const { access, ctrlName, inputs } = link;
  // `inputs` changes when ports come and go, so a controller plugged in later is found.
  const input = useMemo(() => access && ctrlName ? findInputByName(access, ctrlName) : undefined, [access, ctrlName, inputs]);
  const latest = useRef({ learn, patchNow, setValue });
  latest.current = { learn, patchNow, setValue };

  useEffect(() => {
    if (!input) return;
    const l = () => latest.current;
    const handle = controllerHandler({
      assignments: () => l().learn.assignments,
      listening: () => l().learn.listening(),
      learned: (channel, cc) => l().learn.learned(channel, cc),
      read: (t) => readTarget(l().patchNow(), t),
      write: (t, v) => writeTarget(l().patchNow(), t, v, l().setValue),
    });
    const onMessage = (e: Event) => handle((e as MIDIMessageEvent).data ?? []);
    input.addEventListener("midimessage", onMessage);
    void input.open(); // addEventListener, unlike onmidimessage, doesn't open the port by itself
    return () => input.removeEventListener("midimessage", onMessage);
  }, [input]);
}
