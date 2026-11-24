// Sync mode per device: one row per synth output, its mode read back from the H12 and lit. Above them, whether the
// Nome II's input lets Start/Stop through at all; until it does, Own sequencer gets clock but no Start.

import { MODES, type SyncDevice, type SyncMode, type SyncState } from "../core/sync";
import { portName } from "../core/ports";
import { BackupLine, Result } from "../settings/WriteResult";
import type { Sync } from "./useSync";

const disabled = (s: Sync) => !s.ready || !!s.busy;

function ModeButtons({ s, device, mode }: { s: Sync; device: SyncDevice; mode: SyncMode | "custom" }) {
  return (
    <div className="modes">
      {MODES.filter((m) => device.modes.includes(m.mode)).map((m) => (
        <button key={m.mode} className={m.mode === mode ? "on" : ""} aria-pressed={m.mode === mode} title={m.hint}
          aria-label={`${m.label} for ${device.name}`} disabled={disabled(s)} onClick={() => s.setDeviceMode(device, m.mode)}>
          {m.label}
        </button>
      ))}
      {mode === "custom" && <span className="bad">custom bits: set in HxMIDI Tools</span>}
    </div>
  );
}

function Devices({ s, state }: { s: Sync; state: SyncState }) {
  return (
    <table className="sync-table">
      <tbody>
        {state.devices.map(({ device, mode }) => (
          <tr key={device.name}>
            <td>{device.name}<br /><span className="dim">{portName(device.output)}</span></td>
            <td><ModeButtons s={s} device={device} mode={mode} /></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function NomeInput({ s, state }: { s: Sync; state: SyncState }) {
  if (state.nomeOpen) {
    return (
      <p className="note">
        The Nome II's input lets Start/Stop through: a device on <strong>Own sequencer</strong> starts with the Nome II
        (a change made while it plays takes effect at the next Start).{" "}
        <button disabled={disabled(s)} onClick={() => s.setNomeOpen(false)}>Block Start/Stop again</button>
      </p>
    );
  }
  return (
    <p className="note">
      The Nome II's input (MIDI In 1) blocks Start/Stop, so no device starts with it whatever its mode. Set every device
      to External or Free first, then{" "}
      <button disabled={disabled(s)} onClick={() => s.setNomeOpen(true)}>Let Start/Stop through</button>
    </p>
  );
}

function Body({ s }: { s: Sync }) {
  if (s.readProblem) return <p className="bad" role="alert">{s.readProblem}</p>;
  if (!s.state) return <p className="note">Waiting for the H12…</p>;
  return (
    <>
      {s.busy && <p className="note">{s.busy}…</p>}
      <NomeInput s={s} state={s.state} />
      <Devices s={s} state={s.state} />
    </>
  );
}

export function SyncPanel({ s }: { s: Sync }) {
  return (
    <section className="panel sync" aria-busy={!!s.busy}>
      <header>
        <h1>Sync</h1>
        <button disabled={disabled(s)} onClick={s.setAllExternal}>All External</button>
      </header>
      <Body s={s} />
      <Result outcome={s.outcome} />
      <BackupLine backup={s.backup} restore={s.restore} disabled={disabled(s)} what="message filters" />
    </section>
  );
}
