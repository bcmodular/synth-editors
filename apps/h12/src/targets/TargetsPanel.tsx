// The target buttons: the one the H12 is set to is lit; a click switches the Launchkey and the pedal to another.
// Under them, what the last switch wrote, and the way back to the H12's previous settings.

import type { Target } from "../core/targets";
import type { Outcome, Targets } from "./useTargets";

// The H12's port index as the H12 labels it (docs/h12-spec.md › Port index).
export function portName(index: number): string {
  if (index < 16) return `USB host ${index + 1}`;
  if (index < 24) return `USB-C cable ${index - 15}`;
  return `MIDI Out ${index - 23}`;
}

const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? "" : "s"}`;

function summary({ what, restore, report: r }: Outcome): string {
  if (r.written.length === 0 && !r.problem) return `Already on ${what}: nothing written.`;
  const done = `wrote ${plural(r.written.length, "setting")}`;
  const same = r.skipped.length ? `, ${r.skipped.length} already matched` : "";
  if (r.problem) return `Stopped ${restore ? "putting back" : "switching to"} ${what} (${done}${same}).`;
  return `${restore ? "Put back" : "Switched to"} ${what}: ${done}${same}.`;
}

function Result({ outcome }: { outcome: Outcome }) {
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

function TargetButton({ target, t }: { target: Target; t: Targets }) {
  const on = t.active?.name === target.name;
  return (
    <button className={`target${on ? " on" : ""}`} aria-pressed={on} disabled={!t.ready || !!t.busy}
      onClick={() => t.switchTo(target)}>
      <span className="name">{target.name}</span>
      <span className="where">{portName(target.output)} · ch {target.channel}{target.pedalCc !== null
        && ` · pedal CC ${target.pedalCc}`}</span>
    </button>
  );
}

function Now({ t }: { t: Targets }) {
  if (t.readProblem) return <p className="bad" role="alert">{t.readProblem}</p>;
  if (!t.ready) return <p className="note">Waiting for the H12…</p>;
  if (t.busy) return <p className="note">Switching to {t.busy}…</p>;
  if (t.active) return <p className="note">The keys and the pedal play <strong>{t.active.name}</strong>.</p>;
  return <p className="note">The H12's settings don't match any target yet.</p>;
}

function BackupLine({ t }: { t: Targets }) {
  if (!t.backup) return null;
  const date = new Date(t.backup.savedAt).toLocaleString();
  return (
    <p className="note backup">
      The H12's previous settings for these inputs and mappers were saved on {date}.{" "}
      <button disabled={!t.ready || !!t.busy} onClick={t.restore}>Put them back</button>
    </p>
  );
}

export function TargetsPanel({ t }: { t: Targets }) {
  return (
    <section className="panel targets" aria-busy={!!t.busy}>
      <header>
        <h1>Target</h1>
      </header>
      {t.listProblems.length > 0 && (
        <ul className="problems" role="alert">{t.listProblems.map((p) => <li key={p}>{p}</li>)}</ul>
      )}
      <Now t={t} />
      <div className="target-grid">{t.targets.map((target) => <TargetButton key={target.name} target={target} t={t} />)}</div>
      {t.outcome && <Result outcome={t.outcome} />}
      <BackupLine t={t} />
      <p className="note">Close HxMIDI Tools before switching: the H12 should have one writer at a time.</p>
    </section>
  );
}
