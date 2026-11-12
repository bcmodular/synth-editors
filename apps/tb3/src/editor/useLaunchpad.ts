// The Launchpad Pro Mk1 on the LAUNCHPAD IN / OUT ports (docs/tb3-phase4-design.md): Programmer layout, the slots
// and side buttons lit from the session, and its pads and buttons driving the session.
import { useEffect, useMemo, useRef, useState } from "react";
import { findInputByName, findOutputByName } from "@synth-editors/midi";
import {
  allLedsOff, ledsRgb, nextProfile, parseLaunchpad, profileNamed, programmerLayout,
} from "@synth-editors/launchpad";
import type { Rgb } from "@synth-editors/launchpad";
import { launchpadHandler } from "./launchpadControl";
import type { LaunchpadSession } from "./launchpadControl";
import { changedLeds, launchpadLeds } from "./launchpadView";
import { load, save } from "./storage";
import type { Tb3Midi } from "./useTb3Midi";

const PROFILE_KEY = "launchpad.brightness";
const NO_HELD: ReadonlySet<number> = new Set();

function useBrightness() {
  const [profile, setProfile] = useState(() => profileNamed(load(PROFILE_KEY)));
  const cycle = () =>
    setProfile((p) => {
      const next = nextProfile(p);
      save(PROFILE_KEY, next);
      return next;
    });
  return { profile, cycle };
}

// Into Programmer layout with every LED off when the output is chosen, and dark again when it's left or the
// window closes.
function useOutput(out: MIDIOutput | null | undefined, sent: { current: Map<number, Rgb> }) {
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

export function useLaunchpad(midi: Tb3Midi, session: LaunchpadSession) {
  const { access, ports, inputs, outputs } = midi;
  // `inputs` / `outputs` change on (re)connect.
  const out = useMemo(() => access && findOutputByName(access, ports.lpOut), [access, ports.lpOut, outputs]);
  const input = useMemo(() => access && findInputByName(access, ports.lpIn), [access, ports.lpIn, inputs]);
  const { profile, cycle } = useBrightness();
  const [held, setHeld] = useState(NO_HELD);
  const sent = useRef(new Map<number, Rgb>());
  const latest = useRef({ session, sync: midi.syncFromTb3, cycle });
  latest.current = { session, sync: midi.syncFromTb3, cycle };
  useOutput(out, sent);

  useEffect(() => {
    if (!input) return;
    const handle = launchpadHandler({
      session: () => latest.current.session,
      sync: () => latest.current.sync(),
      cycleBrightness: () => latest.current.cycle(),
      onHeld: setHeld,
    });
    const onMessage = (e: Event) => {
      const event = parseLaunchpad((e as MIDIMessageEvent).data ?? []);
      if (event) handle(event);
    };
    input.addEventListener("midimessage", onMessage);
    return () => input.removeEventListener("midimessage", onMessage);
  }, [input, latest]);

  const { slots, active } = session.state;
  const leds = launchpadLeds({
    filled: slots.map(Boolean), active, mode: session.mode, target: session.morphTarget, held,
    syncing: midi.sync.kind === "waiting", profile,
  });
  useEffect(() => {
    if (!out) return;
    const changed = changedLeds(sent.current, leds);
    if (changed.length === 0) return;
    out.send(ledsRgb(changed));
    for (const [led, c] of changed) sent.current.set(led, c);
  });
}
