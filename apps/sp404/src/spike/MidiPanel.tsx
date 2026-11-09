// MIDI half of the Phase 0 spike: pick a bus and effect, then try each way of selecting, switching and turning
// it. Every message sent is noted in the capture log so the results can be matched to what the device did.

import { findOutputByName, listOutputs, requestMidi, toHex, type PortInfo } from "@synth-editors/midi";
import { useEffect, useState } from "react";
import { cc83For, effectsForBus } from "../core/fx";
import { CC_FX_ON, CC_FX_SELECT, FX_CCS, type Bus } from "../core/fxTypes";
import { controlChange, type MidiMessage } from "../core/midi";

const BUS_NAMES: Record<Bus, string> = { 1: "BUS 1", 2: "BUS 2", 3: "BUS 3", 4: "BUS 4", 5: "INPUT FX" };

function useMidiOutput(note: (text: string) => void) {
  const [access, setAccess] = useState<MIDIAccess>();
  const [ports, setPorts] = useState<PortInfo[]>([]);
  const [name, setName] = useState("");
  useEffect(() => {
    requestMidi().then((a) => {
      setAccess(a);
      setPorts(listOutputs(a));
      a.onstatechange = () => setPorts(listOutputs(a));
    }).catch((e: unknown) => note(`MIDI unavailable: ${String(e)}`));
  }, [note]);
  const send = (label: string, message: MidiMessage) => {
    const out = access && findOutputByName(access, name);
    note(`midi ${label}: ${toHex(message)}${out ? "" : " (no output chosen, not sent)"}`);
    out?.send(message);
  };
  return { ports, name, setName, send };
}

export function MidiPanel({ note }: { note: (text: string) => void }) {
  const midi = useMidiOutput(note);
  const [bus, setBus] = useState<Bus>(1);
  const effects = effectsForBus(bus);
  const [fxId, setFxId] = useState(effects[0]?.id ?? 0);
  const fx = effects.find((f) => f.id === fxId) ?? effects[0];
  const [knob, setKnob] = useState(0);
  const cc = (label: string, number: number, value: number) => midi.send(label, controlChange(bus, number, value));

  return (
    <section>
      <h2>MIDI</h2>
      <div className="row">
        Output
        <select value={midi.name} onChange={(e) => midi.setName(e.target.value)}>
          <option value="">(choose)</option>
          {midi.ports.map((p) => <option key={p.id} value={p.name}>{p.name}</option>)}
        </select>
        Bus
        <select value={bus} onChange={(e) => setBus(Number(e.target.value) as Bus)}>
          {Object.entries(BUS_NAMES).map(([b, n]) => <option key={b} value={b}>{n}</option>)}
        </select>
        Effect
        <select value={fx?.id} onChange={(e) => setFxId(Number(e.target.value))}>
          {effects.map((f) => <option key={f.id} value={f.id}>{f.name} (CC 83 = {cc83For(f, bus)})</option>)}
        </select>
      </div>
      {fx && (
        <div className="row">
          <button onClick={() => cc(`select ${fx.name}`, CC_FX_SELECT, cc83For(fx, bus))}>Select (CC 83)</button>
          <button onClick={() => cc("on", CC_FX_ON, 127)}>On (CC 19 = 127)</button>
          <button onClick={() => cc("off", CC_FX_ON, 0)}>Off (CC 19 = 0)</button>
          <button onClick={() => cc("off via select", CC_FX_SELECT, 0)}>Off (CC 83 = 0)</button>
        </div>
      )}
      {fx && (
        <div className="row">
          {fx.params[0]?.label ?? "Ctrl 1"} (CC {FX_CCS[0]})
          <input type="range" min={0} max={127} value={knob}
            onChange={(e) => {
              setKnob(Number(e.target.value));
              cc("knob 1", FX_CCS[0], Number(e.target.value));
            }} />
          {knob}
        </div>
      )}
    </section>
  );
}
