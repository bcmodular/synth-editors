import { useEffect, useState } from "react";
import type { Targets } from "./useTargets";

// The CC the pedal sends the target, one for every target for now. Set writes mapper 23 (when a target is set).
export function PedalCc({ t }: { t: Targets }) {
  const [draft, setDraft] = useState(String(t.pedalCc));
  useEffect(() => setDraft(String(t.pedalCc)), [t.pedalCc]);
  const cc = Number(draft);
  const valid = draft !== "" && Number.isInteger(cc) && cc >= 0 && cc <= 127;
  return (
    <form className="pedal" onSubmit={(e) => { e.preventDefault(); if (valid) t.setPedalCc(cc); }}>
      <label>
        Pedal sends CC{" "}
        <input type="number" min={0} max={127} value={draft} aria-label="Pedal CC"
          onChange={(e) => setDraft(e.target.value)} />
      </label>
      <button type="submit" disabled={!valid || cc === t.pedalCc || !!t.busy}>Set</button>
      <span className="dim">to every target</span>
    </form>
  );
}
