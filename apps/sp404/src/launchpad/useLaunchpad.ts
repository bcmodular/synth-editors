// The Launchpad Pro Mk1 for the SP-404 FX (docs/sp404-design.md › Controllers › Launchpad Pro): found by name, put in
// Programmer layout, its pads and buttons driving the FX (lpControl.ts) and its LEDs following them (lpView.ts).

import { useEffect, useRef, useState } from "react";
import {
  allLedsOff, ledsRgb, nextProfile, parseLaunchpad, profileNamed, programmerLayout, type ProfileName, type Rgb,
} from "@synth-editors/launchpad";
import type { Fx } from "../fx/useFx";
import { usePortsNamed, type PortMatch } from "../midi/usePortsNamed";
import { launchpadHandler, NO_LOCAL, type LpLocal } from "./lpControl";
import { changedLeds, launchpadLeds } from "./lpView";

// The Launchpad Pro's ports; Programmer layout talks on its Standalone port (macOS names the three ports Live,
// Standalone and MIDI).
export const LAUNCHPAD: PortMatch = {
  name: /Launchpad Pro/i,
  rank: (name) => (/standalone/i.test(name) ? 0 : /live/i.test(name) ? 2 : 1),
};

const PROFILE_KEY = "sp404.launchpadBrightness";

function useBrightness() {
  const [profile, setProfile] = useState<ProfileName>(() => profileNamed(localStorage.getItem(PROFILE_KEY)));
  const cycle = () => setProfile((p) => {
    const next = nextProfile(p);
    localStorage.setItem(PROFILE_KEY, next);
    return next;
  });
  return { profile, cycle };
}

// Into Programmer layout with every LED off when the output appears, and dark again when it goes or the window closes.
function useOutput(out: MIDIOutput | undefined, sent: { current: Map<number, Rgb> }) {
  useEffect(() => {
    if (!out) return;
    sent.current = new Map();
    out.send(programmerLayout());
    out.send(allLedsOff());
    const dark = () => out.send(allLedsOff());
    window.addEventListener("pagehide", dark);
    return () => {
      window.removeEventListener("pagehide", dark);
      dark();
    };
  }, [out, sent]);
}

function useInput(input: MIDIInput | undefined, latest: React.RefObject<{ fx: Fx; cycle: () => void }>,
  onLocal: (l: LpLocal) => void) {
  useEffect(() => {
    if (!input) return;
    const handle = launchpadHandler({ fx: () => latest.current.fx, cycleBrightness: () => latest.current.cycle(), onLocal });
    const onMessage = (e: MIDIMessageEvent) => {
      const event = parseLaunchpad(e.data ?? []);
      if (event) handle(event);
    };
    input.addEventListener("midimessage", onMessage);
    return () => input.removeEventListener("midimessage", onMessage);
  }, [input, latest, onLocal]);
}

export function useLaunchpad(fx: Fx): { name?: string } {
  const { input, output } = usePortsNamed(LAUNCHPAD);
  const { profile, cycle } = useBrightness();
  const [local, setLocal] = useState<LpLocal>(NO_LOCAL);
  const sent = useRef(new Map<number, Rgb>());
  const latest = useRef({ fx, cycle });
  latest.current = { fx, cycle };
  useOutput(output, sent);
  useInput(input, latest, setLocal);

  const leds = launchpadLeds(fx, local, profile);
  useEffect(() => {
    if (!output) return;
    const changed = changedLeds(sent.current, leds);
    if (changed.length === 0) return;
    output.send(ledsRgb(changed));
    for (const [led, c] of changed) sent.current.set(led, c);
  });
  return { name: output?.name ?? undefined };
}
