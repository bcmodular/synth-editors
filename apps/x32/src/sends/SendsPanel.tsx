// Sends without chat (docs/x32-spec.md, phase 3): pick a source and a destination by the desk's names and send, send
// only this (switching the others off), or stop. The same planner, guards, confirmation and undo as the chat.

import { useState } from "react";
import { removeSend, sendTo, type SendMode } from "../core/planner";
import type { Rig } from "../core/rig";
import { PlanView } from "../plans/PlanView";
import { studioShared } from "../plans/studioShared";
import type { Plans } from "../plans/useOperator";

// Every name a send can go to: the named buses, and each target of a shared bus ("P-6": the Sampler, switched to it).
export function destinationNames(rig: Rig): string[] {
  const targets = studioShared.flatMap((s) => s.targets.map((t) => t.name));
  return [...new Set([...rig.destinations.map((d) => d.name), ...targets])];
}

function Picker({ label, value, options, set }: { label: string; value: string; options: string[]; set: (v: string) => void }) {
  return (
    <label>
      {label}{" "}
      <select value={value} onChange={(e) => set(e.target.value)} aria-label={label}>
        <option value="">—</option>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </label>
  );
}

export function SendsPanel({ rig, plans, connected }: { rig: Rig; plans: Plans; connected: boolean }) {
  const [source, setSource] = useState("");
  const [destination, setDestination] = useState("");
  const [db, setDb] = useState("0");
  const ready = connected && !plans.busy && !!source && !!destination;
  const send = (mode: SendMode) => void plans.run((ctx) => sendTo(ctx, { source, destination, mode, levelDb: Number(db) || 0 }));
  return (
    <section className="panel sends">
      <header>
        <h1>Sends</h1>
      </header>
      <div className="form">
        <Picker label="From" value={source} options={rig.sources.map((s) => s.name)} set={setSource} />
        <Picker label="To" value={destination} options={destinationNames(rig)} set={setDestination} />
        <label>
          Level <input type="number" step="1" min="-90" max="10" value={db} onChange={(e) => setDb(e.target.value)} aria-label="Level" /> dB
        </label>
      </div>
      <div className="buttons">
        <button type="button" disabled={!ready} onClick={() => send("add")}>Send</button>
        <button type="button" disabled={!ready} onClick={() => send("replace")}>Send only this</button>
        <button type="button" disabled={!ready} onClick={() => void plans.run((ctx) => removeSend(ctx, { source, destination }))}>
          Stop sending
        </button>
      </div>
      <PlanView plans={plans} />
    </section>
  );
}
