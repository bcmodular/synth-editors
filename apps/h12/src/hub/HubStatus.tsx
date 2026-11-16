// The read-only check, shown: which H12 port answers SysEx, its firmware and current preset.

import type { HubReport } from "../core/hub";
import { MIN_FIRMWARE } from "../core/status";
import type { HubState } from "./useHub";

const MIN = `${MIN_FIRMWARE.major}.${MIN_FIRMWARE.minor}`;

function Message({ state }: { state: Exclude<HubState, { kind: "ready" }> }) {
  switch (state.kind) {
    case "starting":
    case "probing":
      return <p className="note">Looking for the H12…</p>;
    case "no-midi":
      return <p className="note bad">MIDI isn't available: {state.message}</p>;
    case "absent":
      return <p className="note bad">No H12MIDI Pro ports. Is the H12 connected over USB?</p>;
    case "silent":
      return (
        <p className="note bad" role="alert">
          The H12 didn't answer on any port ({state.tried.join(", ")}). Is HxMIDI Tools holding it?
        </p>
      );
  }
}

function Firmware({ report }: { report: HubReport }) {
  const f = report.firmware;
  if (!f) return <dd className="bad">unknown</dd>;
  if (report.firmwareOk) return <dd className="good">{f.version}</dd>;
  return <dd className="bad" role="alert">{f.version}: older than {MIN}, which the app was written for</dd>;
}

function Preset({ report }: { report: HubReport }) {
  const p = report.preset;
  if (!p) return <dd className="bad">unknown</dd>;
  if (p.index === 0) return <dd className="good">1 (Main)</dd>;
  return <dd className="bad" role="alert">{p.index + 1}: switch to preset 1 before changing targets</dd>;
}

function Report({ report }: { report: HubReport }) {
  return (
    <>
      <dl className="facts">
        <dt>SysEx port</dt>
        <dd>{report.output}{report.input !== report.output && <> (answers on {report.input})</>}</dd>
        <dt>Firmware</dt>
        <Firmware report={report} />
        <dt>Serial</dt>
        <dd className="mono">{report.firmware?.serial ?? "unknown"}</dd>
        <dt>Preset</dt>
        <Preset report={report} />
      </dl>
      {report.problems.length > 0 && (
        <ul className="problems" role="alert">{report.problems.map((p) => <li key={p}>{p}</li>)}</ul>
      )}
    </>
  );
}

export function HubStatus({ state, recheck }: { state: HubState; recheck: () => void }) {
  const busy = state.kind === "starting" || state.kind === "probing";
  return (
    <section className="panel hub" aria-busy={busy}>
      <header>
        <h1>H12MIDI Pro</h1>
        <button onClick={recheck} disabled={busy}>Check again</button>
      </header>
      {state.kind === "ready" ? <Report report={state.report} /> : <Message state={state} />}
    </section>
  );
}
