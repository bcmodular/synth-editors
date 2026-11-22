// The tempo bridge over Web MIDI (docs/x32-spec.md, "Tempo bridge"): listens to MIDI clock on one input ("Nome II
// Clock" when it's there) and shows the tempo. Nothing is written until the button is pressed: changing a delay's
// time while it plays is audible. In the end-to-end tests there's no MIDI; window.x32TestClock feeds the meter instead.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { listInputs, requestMidi, type PortInfo } from "@synth-editors/midi";
import { roundBpm, TempoMeter, tempoPlan } from "../core/tempo";
import { testMode } from "../desk/relay";
import type { Message, Plans } from "../plans/useOperator";

const DEFAULT_INPUT = /^Nome II Clock/i;
const INPUT_KEY = "x32.tempo.input";
const SHOW_EVERY_MS = 250;
export const TEST_INPUT = "Test clock";

export interface TempoState {
  inputs: PortInfo[];
  input: string; // the chosen input's name, "" for none
  choose: (name: string) => void;
  bpm: number | null; // the tempo (the last one, after Stop)
  running: boolean;
  settled: boolean;
  midiError: string | null;
  set: () => Promise<Message | null>; // the button: write every synced delay's Time
}

declare global {
  interface Window {
    x32TestClock?: (data: number[], at: number) => void;
  }
}

const remembered = (): string => {
  try {
    return localStorage.getItem(INPUT_KEY) ?? "";
  } catch {
    return "";
  }
};

const remember = (name: string) => {
  try {
    localStorage.setItem(INPUT_KEY, name);
  } catch {
    // no storage: the choice lasts until the app closes
  }
};

// The MIDI inputs, kept current as ports come and go, or the test clock alone in the tests.
function useInputs(): { access: MIDIAccess | null; inputs: PortInfo[]; error: string | null } {
  const [access, setAccess] = useState<MIDIAccess | null>(null);
  const [inputs, setInputs] = useState<PortInfo[]>([]);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    void testMode().then(async (test) => {
      if (test) return setInputs([{ id: TEST_INPUT, name: TEST_INPUT }]);
      try {
        const a = await requestMidi();
        setAccess(a);
        setInputs(listInputs(a));
        a.onstatechange = () => setInputs(listInputs(a));
      } catch (e) {
        setError((e as Error).message);
      }
    });
  }, []);
  return { access, inputs, error };
}

// The chosen input: remembered, else the Nome II's clock port, else none.
function pick(inputs: PortInfo[], chosen: string): string {
  if (inputs.some((p) => p.name === chosen)) return chosen;
  return inputs.find((p) => DEFAULT_INPUT.test(p.name) || p.name === TEST_INPUT)?.name ?? "";
}

// Feeds the meter from the chosen input while it's chosen.
function useListen(access: MIDIAccess | null, input: string, meter: TempoMeter) {
  useEffect(() => {
    if (input === TEST_INPUT) {
      window.x32TestClock = (data, at) => meter.take(data, at);
      return () => void delete window.x32TestClock;
    }
    const port = access ? [...access.inputs.values()].find((p) => p.name === input) : undefined;
    if (!port) return;
    const onMessage = (e: MIDIMessageEvent) => e.data && meter.take(e.data, e.timeStamp);
    port.addEventListener("midimessage", onMessage);
    return () => port.removeEventListener("midimessage", onMessage);
  }, [access, input, meter]);
}

// The meter's readings, a few times a second (clock ticks come 48 times a second at 120 BPM).
function useReadings(meter: TempoMeter) {
  const [shown, setShown] = useState({ bpm: null as number | null, running: false, settled: false });
  useEffect(() => {
    const id = setInterval(() => {
      const next = { bpm: meter.last === null ? null : roundBpm(meter.last), running: meter.running, settled: meter.settled };
      setShown((s) => (s.bpm === next.bpm && s.running === next.running && s.settled === next.settled ? s : next));
    }, SHOW_EVERY_MS);
    return () => clearInterval(id);
  }, [meter]);
  return shown;
}

export function useTempoBridge(plans: Plans): TempoState {
  const meter = useMemo(() => new TempoMeter(), []);
  const { access, inputs, error } = useInputs();
  const [chosen, setChosen] = useState(remembered);
  const input = pick(inputs, chosen);
  useListen(access, input, meter);
  const shown = useReadings(meter);
  const latest = useRef(plans);
  latest.current = plans;

  const choose = useCallback((name: string) => {
    setChosen(name);
    remember(name);
  }, []);
  const set = useCallback(async () => {
    if (shown.bpm === null) return null;
    const bpm = shown.bpm;
    return latest.current.applyNow((ctx) => tempoPlan(ctx, bpm));
  }, [shown.bpm]);

  return { inputs, input, choose, ...shown, midiError: error, set };
}
