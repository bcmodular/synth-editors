// The Launchkey clock test, shown (docs/h12-spec.md › Clock forwarder; CLAUDE.md build order step 2). Turn the
// Launchkey's arpeggiator on, start the clock here, and see whether the arpeggio follows the tempo.

import { MAX_BPM, MIN_BPM } from "../core/clock";
import type { ClockTest, Source } from "./useClockTest";

function Ports({ test }: { test: ClockTest }) {
  return (
    <dl className="facts">
      <dt>Launchkey</dt>
      {test.out ? <dd>{test.out.name}</dd> : <dd className="bad">no Launchkey MIDI port</dd>}
      <dt>Nome II</dt>
      <dd>
        {test.nome ? test.nome.name : <span className="bad">no Nome II Clock port</span>}
        {test.nome && <span className="dim"> · {test.nomeBpm ? `${test.nomeBpm.toFixed(1)} BPM` : "no clock"}</span>}
      </dd>
    </dl>
  );
}

function SourceChoice({ test }: { test: ClockTest }) {
  const choice = (value: Source, label: string, disabled = false) => (
    <label>
      <input type="radio" name="source" value={value} checked={test.source === value} disabled={disabled}
        onChange={() => test.setSource(value)} /> {label}
    </label>
  );
  return (
    <fieldset className="choices" disabled={test.running}>
      <legend>Clock</legend>
      {choice("generated", "Generated here")}
      {choice("nome", "Forwarded from the Nome II", !test.nome)}
    </fieldset>
  );
}

function Tempo({ test }: { test: ClockTest }) {
  if (test.source !== "generated") return null;
  return (
    <label className="tempo">
      Tempo
      <input type="range" min={MIN_BPM} max={MAX_BPM} value={test.bpm} aria-label="Tempo slider"
        onChange={(e) => test.setBpm(Number(e.target.value))} />
      <input type="number" min={MIN_BPM} max={MAX_BPM} value={test.bpm} aria-label="Tempo"
        onChange={(e) => test.setBpm(Number(e.target.value))} />
      BPM
    </label>
  );
}

export function ClockTestPanel({ test }: { test: ClockTest }) {
  const canRun = !!test.out && (test.source === "generated" || !!test.nome);
  return (
    <section className="panel clock">
      <header>
        <h1>Launchkey clock test</h1>
        <button className={test.running ? "on" : ""} disabled={!canRun && !test.running}
          onClick={() => test.setRunning(!test.running)}>
          {test.running ? "Stop" : "Start"}
        </button>
      </header>
      <p className="note">
        Turn the Launchkey's arpeggiator on and hold a chord, then start the clock. If the arpeggio follows the tempo
        here, the Launchkey takes clock on its USB MIDI port. In Ableton, turn Sync off for the Launchkey's ports
        while testing, so it gets one clock only.
      </p>
      <Ports test={test} />
      <SourceChoice test={test} />
      <Tempo test={test} />
      <label className="check">
        <input type="checkbox" checked={test.transport} onChange={(e) => test.setTransport(e.target.checked)} />
        {" "}Also send Start, Stop and Continue
      </label>
      {test.running && <p className="note" aria-live="polite">{test.ticks} clock ticks sent</p>}
    </section>
  );
}
