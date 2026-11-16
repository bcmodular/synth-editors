// The Launchkey clock test over Web MIDI (core/clock.ts): sends clock to the Launchkey's MIDI port (never its DAW
// port), either generated here at a set tempo or forwarded from the Nome II's "Nome II Clock" port. Nothing goes to
// the H12, and nothing from the Launchkey's own ports is ever forwarded.

import { useEffect, useRef, useState, type RefObject } from "react";
import { ClockGenerator, forwards, TempoMeter, CLOCK } from "../core/clock";
import { portsNamed, type Midi } from "../midi/useMidi";

const LAUNCHKEY_MIDI_IN = /^Launchkey.*MIDI In/i;
const NOME_CLOCK = /^Nome II Clock/i;
const COUNT_MS = 250;
const BPM_KEY = "h12.clockTest.bpm";

export type Source = "generated" | "nome";

const browserTime = {
  now: () => performance.now(),
  every: (ms: number, fn: () => void) => {
    const id = setInterval(fn, ms);
    return () => clearInterval(id);
  },
};

function useClockPorts({ access }: Midi, ports: string) {
  const [found, setFound] = useState<{ out?: MIDIOutput; nome?: MIDIInput }>({});
  useEffect(() => {
    if (!access) return;
    setFound({
      out: portsNamed(access.outputs.values(), LAUNCHKEY_MIDI_IN)[0],
      nome: portsNamed(access.inputs.values(), NOME_CLOCK)[0],
    });
  }, [access, ports]);
  return found;
}

// What both sources share: the Launchkey's port, the transport option (read as it's needed, so changing it doesn't
// restart the clock) and a count of the clock ticks sent.
interface Wiring {
  out?: MIDIOutput;
  transport: RefObject<boolean>;
  sent: RefObject<number>;
}

// Clock generated here while active. The tempo follows bpm; transport is read when starting and stopping.
function useGenerated({ out, transport, sent }: Wiring, active: boolean, bpm: number) {
  const gen = useRef<ClockGenerator>(undefined);
  useEffect(() => {
    if (!active) return;
    if (!out) return;
    const g = new ClockGenerator((data, at) => {
      out.send(data, at);
      if (data[0] === CLOCK) sent.current++;
    }, browserTime, bpm);
    gen.current = g;
    g.start(transport.current);
    return () => {
      g.stop(transport.current);
      gen.current = undefined;
    };
    // Not on bpm: a tempo change goes to the running generator below, without restarting it.
  }, [out, active]);
  useEffect(() => gen.current?.setBpm(bpm), [bpm]);
}

// The Nome II's clock forwarded as each message arrives, with no batching or timers.
function useForward({ out, transport, sent }: Wiring, nome: MIDIInput | undefined, active: boolean) {
  useEffect(() => {
    if (!active || !nome) return;
    if (!out) return;
    const onMessage = (e: MIDIMessageEvent) => {
      if (!e.data || !forwards(e.data, transport.current)) return;
      out.send(e.data);
      if (e.data[0] === CLOCK) sent.current++;
    };
    nome.addEventListener("midimessage", onMessage);
    return () => nome.removeEventListener("midimessage", onMessage);
  }, [out, nome, active, transport, sent]);
}

// The tempo the Nome II is sending, whether or not it's being forwarded.
function useNomeTempo(nome: MIDIInput | undefined) {
  const [bpm, setBpm] = useState<number>();
  useEffect(() => {
    setBpm(undefined);
    if (!nome) return;
    const meter = new TempoMeter();
    let last = 0;
    const onMessage = (e: MIDIMessageEvent) => {
      if (e.data?.[0] !== CLOCK) return;
      meter.tick(e.timeStamp);
      last = e.timeStamp;
    };
    nome.addEventListener("midimessage", onMessage);
    const id = setInterval(() => {
      if (performance.now() - last > 1000) meter.reset(); // stopped
      setBpm(meter.bpm);
    }, 500);
    return () => {
      clearInterval(id);
      nome.removeEventListener("midimessage", onMessage);
    };
  }, [nome]);
  return bpm;
}

// Clock ticks sent since the test started, refreshed a few times a second while it runs.
function useSentCount(running: boolean, sent: RefObject<number>) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!running) return;
    sent.current = 0;
    setCount(0);
    const id = setInterval(() => setCount(sent.current), COUNT_MS);
    return () => clearInterval(id);
  }, [running, sent]);
  return count;
}

function readBpm(): number {
  try {
    const v = Number(localStorage.getItem(BPM_KEY));
    return Number.isFinite(v) && v > 0 ? v : 120;
  } catch {
    return 120;
  }
}

export function useClockTest(midi: Midi) {
  const { out, nome } = useClockPorts(midi, midi.ports);
  const [source, setSource] = useState<Source>("generated");
  const [bpm, setBpmState] = useState(readBpm);
  const [transport, setTransport] = useState(false);
  const [running, setRunning] = useState(false);
  const transportRef = useRef(transport);
  transportRef.current = transport;
  const sent = useRef(0);

  const wiring: Wiring = { out, transport: transportRef, sent };
  useGenerated(wiring, running && source === "generated", bpm);
  useForward(wiring, nome, running && source === "nome");
  const nomeBpm = useNomeTempo(nome);
  const ticks = useSentCount(running, sent);

  const setBpm = (v: number) => {
    setBpmState(v);
    localStorage.setItem(BPM_KEY, String(v));
  };
  return {
    out, nome, nomeBpm, ticks, source, setSource, bpm, setBpm, transport, setTransport, running, setRunning,
  };
}

export type ClockTest = ReturnType<typeof useClockTest>;
