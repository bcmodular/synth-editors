// The tempo bridge (docs/x32-spec.md, phase 6): the clock's tempo, the delays it syncs and their times now, and the
// one button that writes them. Nothing changes until it's pressed.

import { useState, useSyncExternalStore } from "react";
import { syncedDelays, timeMs, type SyncedDelay } from "../core/tempo";
import type { Message, Plans } from "../plans/useOperator";
import { freeDelays, onFreeChange, setFree } from "./freeDelays";
import type { TempoState } from "./useTempoBridge";

const NOTE: Record<number, string> = { 0.5: "an eighth", 1: "a quarter" };

function clockText(t: TempoState): string {
  if (!t.input) return t.midiError ? `MIDI isn't available: ${t.midiError}` : "Pick the clock input.";
  if (t.bpm === null) return "Waiting for clock…";
  if (!t.running) return `Stopped at ${t.bpm.toFixed(1)} BPM`;
  return `${t.bpm.toFixed(1)} BPM${t.settled ? "" : " (settling)"}`;
}

function DelayRow({ d, bpm }: { d: SyncedDelay; bpm: number | null }) {
  const next = bpm === null || d.free ? "" : ` → ${Math.round(timeMs(bpm, d.beats))} ms`;
  const note = d.free ? "runs free" : `Time is ${NOTE[d.beats] ?? `${d.beats} beats`}`;
  return (
    <li className={d.free ? "free" : ""}>
      <label>
        <input type="checkbox" checked={!d.free} onChange={(e) => setFree(d.slot, !e.target.checked)} aria-label={`FX ${d.slot} follows the tempo`} />{" "}
        FX {d.slot} {d.name}: {d.time}{next}
      </label>{" "}
      <span className="dim">({note}; {d.factors})</span>
    </li>
  );
}

// Ready when there's a tempo that isn't moving (or the clock has stopped on one), delays to set and a desk to set them on.
const ready = (t: TempoState, delays: SyncedDelay[], connected: boolean) =>
  connected && delays.some((d) => !d.free) && t.bpm !== null && (t.settled || !t.running);

export function TempoPanel({ tempo, plans, connected }: { tempo: TempoState; plans: Plans; connected: boolean }) {
  const [done, setDone] = useState<Message | null>(null);
  useSyncExternalStore(onFreeChange, freeDelays); // a switch changes the list and the button
  const delays = syncedDelays(plans.context());
  const press = async () => setDone(await tempo.set());
  return (
    <section className="panel tempo">
      <header>
        <h1>Tempo</h1>
        <select aria-label="Clock input" value={tempo.input} onChange={(e) => tempo.choose(e.target.value)}>
          <option value="">No clock input</option>
          {tempo.inputs.map((p) => <option key={p.id} value={p.name}>{p.name}</option>)}
        </select>
      </header>
      <p className="clock">{clockText(tempo)}</p>
      {delays.length ? (
        <ul className="delays">{delays.map((d) => <DelayRow key={d.slot} d={d} bpm={tempo.bpm} />)}</ul>
      ) : (
        <p className="note">No FX slot holds a delay the bridge syncs (Stereo, 3-Tap or Rhythm Delay).</p>
      )}
      <div className="buttons">
        <button type="button" disabled={!ready(tempo, delays, connected) || plans.busy} onClick={() => void press()}>
          {tempo.bpm === null ? "Set delays to the tempo" : `Set delays to ${tempo.bpm.toFixed(1)} BPM`}
        </button>
        <span className="dim">Changing a delay's time while it plays is audible, so it's only done when you press this.</span>
      </div>
      {done && <p className={`note outcome ${done.bad ? "bad" : ""}`}>{done.text}</p>}
    </section>
  );
}
