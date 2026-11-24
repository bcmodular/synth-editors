// What the Target and Sync panels show under their buttons: what the last change wrote, and the way back to the
// H12's previous settings.

import { summary, type Outcome } from "./useWriter";
import type { Backup } from "../core/backup";

export function Result({ outcome }: { outcome?: Outcome }) {
  if (!outcome) return null;
  const r = outcome.report;
  return (
    <div className="result">
      <p className={r.problem ? "bad" : "note"} role={r.problem ? "alert" : "status"}>
        {summary(outcome)}{r.problem && <><br />{r.problem}</>}
      </p>
      {r.written.length > 0 && <ul className="written">{r.written.map((w) => <li key={w}>{w}</li>)}</ul>}
    </div>
  );
}

export function BackupLine({ backup, restore, disabled, what }:
{ backup?: Backup; restore: () => void; disabled: boolean; what: string }) {
  if (!backup) return null;
  const date = new Date(backup.savedAt).toLocaleString();
  return (
    <p className="note backup">
      The H12's previous {what} were saved on {date}.{" "}
      <button disabled={disabled} onClick={restore}>Put them back</button>
    </p>
  );
}
