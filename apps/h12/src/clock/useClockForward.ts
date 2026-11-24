// The clock forwarder over Web MIDI (core/clock.ts): always on, it sends the Nome II's clock and Start, Stop and
// Continue from its "Nome II Clock" port to the Launchkey's MIDI port (never its DAW port), each message as it
// arrives. Nothing goes to the H12, and nothing from the Launchkey's own ports is ever forwarded. The ports are found
// again whenever the set of ports changes, so unplugging either device pauses forwarding until it's back.

import { useEffect, useState } from "react";
import { CLOCK, forwards, TempoMeter } from "../core/clock";
import { portsNamed, type Midi } from "../midi/useMidi";

const LAUNCHKEY_MIDI_IN = /^Launchkey.*MIDI In/i;
const NOME_CLOCK = /^Nome II Clock/i;
const STOPPED_MS = 1000;
const SHOW_MS = 500;

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

// Each message forwarded as it arrives, with no batching or timers.
function useForward(nome: MIDIInput | undefined, out: MIDIOutput | undefined) {
  useEffect(() => {
    if (!nome || !out) return;
    const onMessage = (e: MIDIMessageEvent) => {
      if (e.data && forwards(e.data)) out.send(e.data);
    };
    nome.addEventListener("midimessage", onMessage);
    return () => nome.removeEventListener("midimessage", onMessage);
  }, [nome, out]);
}

// The tempo the Nome II is sending; undefined while it sends no clock.
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
      if (performance.now() - last > STOPPED_MS) meter.reset();
      setBpm(meter.bpm);
    }, SHOW_MS);
    return () => {
      clearInterval(id);
      nome.removeEventListener("midimessage", onMessage);
    };
  }, [nome]);
  return bpm;
}

export function useClockForward(midi: Midi) {
  const { out, nome } = useClockPorts(midi, midi.ports);
  useForward(nome, out);
  const bpm = useNomeTempo(nome);
  return { out, nome, bpm };
}

export type ClockForward = ReturnType<typeof useClockForward>;
