// The Launchkey clock: the Nome II's clock forwarded to the Launchkey's arpeggiator, always on (useClockForward).

import type { ClockForward } from "./useClockForward";

function Status({ c }: { c: ClockForward }) {
  if (!c.out || !c.nome) return <p className="note">Forwarding resumes when both are connected.</p>;
  const tempo = c.bpm ? `${c.bpm.toFixed(1)} BPM` : "no clock from the Nome II yet";
  return <p className="note" aria-live="polite">Forwarding clock and Start, Stop, Continue: {tempo}</p>;
}

export function ClockPanel({ c }: { c: ClockForward }) {
  return (
    <section className="panel clock">
      <header>
        <h1>Launchkey clock</h1>
      </header>
      <dl className="facts">
        <dt>From</dt>
        <dd>{c.nome ? c.nome.name : <span className="bad">no Nome II Clock port</span>}</dd>
        <dt>To</dt>
        <dd>{c.out ? c.out.name : <span className="bad">no Launchkey MIDI port</span>}</dd>
      </dl>
      <Status c={c} />
      <p className="note">In Ableton, keep Sync off for the Launchkey's ports, so the arpeggiator gets one clock only.</p>
    </section>
  );
}
