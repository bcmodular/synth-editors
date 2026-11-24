// The target buttons: the one the H12 is set to is lit; a click switches the Launchkey and the pedal to another.
// Under them, what the last switch wrote, and the way back to the H12's previous settings.

import { useEffect, useState } from "react";
import { portName } from "../core/ports";
import { MONITOR_PORT, type Target } from "../core/targets";
import { BackupLine, Result } from "../settings/WriteResult";
import type { Targets } from "./useTargets";

// A multitimbral target's channels: one small button each, the one it's set to lit.
function Channels({ target, t, active }: { target: Target; t: Targets; active?: number }) {
  if (!target.channels) return null;
  return (
    <div className="channels">
      {target.channels.map((ch) => (
        <button key={ch} className={ch === active ? "on" : ""} aria-pressed={ch === active}
          aria-label={`Channel ${ch} for ${target.name}`} disabled={!t.ready || !!t.busy}
          onClick={() => t.switchTo(target, ch)}>{ch}</button>
      ))}
    </div>
  );
}

function TargetButton({ target, t }: { target: Target; t: Targets }) {
  const active = t.active?.target.name === target.name ? t.active.channel : undefined;
  const on = active !== undefined;
  return (
    <div className={`target${on ? " on" : ""}`}>
      <button aria-pressed={on} disabled={!t.ready || !!t.busy} onClick={() => t.switchTo(target)}>
        <span className="name">{target.name}</span>
        <span className="where">{portName(target.output)} · ch {active ?? target.channel}</span>
      </button>
      <Channels target={target} t={t} active={active} />
    </div>
  );
}

function Now({ t }: { t: Targets }) {
  if (t.readProblem) return <p className="bad" role="alert">{t.readProblem}</p>;
  if (!t.ready) return <p className="note">Waiting for the H12…</p>;
  if (t.busy) return <p className="note">{t.busy}…</p>;
  if (t.active) {
    const { target, channel } = t.active;
    const name = target.channels ? `${target.name} on channel ${channel}` : target.name;
    return <p className="note">The keys and the pedal play <strong>{name}</strong>.</p>;
  }
  return <p className="note">The H12's settings don't match any target yet.</p>;
}

// Also sends what the keys and the pedal play to the Mac, after the mappers, for the MIDI monitor.
function MonitorSwitch({ t }: { t: Targets }) {
  return (
    <label className="check">
      <input type="checkbox" checked={t.active?.monitor ?? false} disabled={!t.active || !!t.busy}
        onChange={(e) => t.setMonitor(e.target.checked)} />
      {" "}Copy to the Mac ({MONITOR_PORT}), for the MIDI monitor
    </label>
  );
}

// The CC the pedal sends the target, one for every target for now. Set writes mapper 23 (when a target is set).
function PedalCc({ t }: { t: Targets }) {
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

// Mappers the app wrote before it knew firmware 4.x needs 5A in word 3: switching target rewrites them.
function InitWarning({ t }: { t: Targets }) {
  if (t.withoutInit.length === 0) return null;
  return (
    <div className="problems" role="alert">
      <p>
        <strong>Don't power off the H12 yet.</strong> {t.withoutInit.join(", ")} lack the init byte 5A, so at
        power-up it would reset every setting to factory defaults. Click a target to rewrite them.
      </p>
    </div>
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
      <InitWarning t={t} />
      <Now t={t} />
      <div className="target-grid">{t.targets.map((target) => <TargetButton key={target.name} target={target} t={t} />)}</div>
      <PedalCc t={t} />
      <MonitorSwitch t={t} />
      <Result outcome={t.outcome} />
      <BackupLine backup={t.backup} restore={t.restore} disabled={!t.ready || !!t.busy}
        what="settings for these inputs and mappers" />
      <p className="note">Close HxMIDI Tools before switching: the H12 should have one writer at a time.</p>
    </section>
  );
}
