// The MIDI monitor: logs what arrives from the H12's copy to the Mac (what it sends the target, after the mappers),
// the Launchkey's own USB port (what the keys play) and the pedal converter's USB port. Messages are buffered and
// shown a few times a second, newest first by arrival time. Clock and active sensing are left out.

import { useCallback, useEffect, useRef, useState } from "react";
import { describe, isTicker } from "../core/midiText";
import { MONITOR_PORT } from "../core/targets";
import { portsNamed, type Midi } from "../midi/useMidi";

export interface Source {
  label: string;
  port: RegExp;
}

export const SOURCES: Source[] = [
  { label: "H12 → Mac", port: new RegExp(`^${MONITOR_PORT}$`) },
  { label: "Launchkey", port: /^Launchkey.*MIDI Out/ },
  { label: "Pedal", port: /^DOREMiDi/i },
];

export interface LogEntry {
  id: number;
  at: number; // seconds since the monitor started
  source: string;
  channel?: number;
  text: string;
}

const MAX_ENTRIES = 300;

// By arrival time, newest first, so rows from different sources (whose events can be handled a few ms apart) read in
// the order the messages arrived; the same time keeps the order they were logged in.
const newestFirst = (a: LogEntry, b: LogEntry) => b.at - a.at || b.id - a.id;
const FLUSH_MS = 100;

// Each source's input, if connected.
function useSourceInputs({ access, ports }: Midi) {
  const [inputs, setInputs] = useState<{ source: Source; input?: MIDIInput }[]>([]);
  useEffect(() => {
    if (!access) return;
    setInputs(SOURCES.map((source) => ({ source, input: portsNamed(access.inputs.values(), source.port)[0] })));
  }, [access, ports]);
  return inputs;
}

interface Capture {
  pending: LogEntry[];
  next: number;
  start: number;
}

// Whether a message goes in the log: everything but clock and active sensing.
const logged = (data: Uint8Array | null): data is Uint8Array => !!data && !isTicker(data);

function useCapture(inputs: { source: Source; input?: MIDIInput }[], capture: React.RefObject<Capture>) {
  useEffect(() => {
    const removers = inputs.map(({ source, input }) => {
      const onMessage = (e: MIDIMessageEvent) => {
        const c = capture.current;
        if (!logged(e.data)) return;
        c.pending.push({ id: c.next++, at: (e.timeStamp - c.start) / 1000, source: source.label, ...describe(e.data) });
      };
      input?.addEventListener("midimessage", onMessage);
      return () => input?.removeEventListener("midimessage", onMessage);
    });
    return () => removers.forEach((remove) => remove());
  }, [inputs, capture]);
}

export function useMonitor(midi: Midi) {
  const inputs = useSourceInputs(midi);
  const capture = useRef<Capture>({ pending: [], next: 0, start: performance.now() });
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [paused, setPaused] = useState(false);
  useCapture(inputs, capture);

  useEffect(() => {
    const id = setInterval(() => {
      const fresh = capture.current.pending.splice(0);
      if (fresh.length === 0 || paused) return;
      setEntries((was) => [...fresh, ...was].sort(newestFirst).slice(0, MAX_ENTRIES));
    }, FLUSH_MS);
    return () => clearInterval(id);
  }, [paused]);

  const clear = useCallback(() => setEntries([]), []);
  // A line from the app itself (a target switch), in the same timeline as the MIDI.
  const note = useCallback((text: string) => {
    const c = capture.current;
    c.pending.push({ id: c.next++, at: (performance.now() - c.start) / 1000, source: "App", text });
  }, []);
  const connected = inputs.map(({ source, input }) => ({ label: source.label, port: input?.name }));
  return { entries, connected, paused, setPaused, clear, note };
}

export type Monitor = ReturnType<typeof useMonitor>;
