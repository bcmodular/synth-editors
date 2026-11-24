// The MIDI monitor log, newest first. With "Copy to the Mac" on (Target panel), "H12 → Mac" shows what the H12 sends
// the target, so it can be read against what the Launchkey and the pedal send it.

import type { LogEntry, Monitor } from "./useMonitor";

function Sources({ m }: { m: Monitor }) {
  return (
    <p className="note">
      Listening to{" "}
      {m.connected.map((s, i) => (
        <span key={s.label} className={s.port ? "" : "dim"} title={s.port ?? "not connected"}>
          {i > 0 && ", "}{s.label}{!s.port && " (not connected)"}
        </span>
      ))}
      . Turn on <em>Copy to the Mac</em> in the Target panel to see what the H12 sends.
    </p>
  );
}

function Row({ e }: { e: LogEntry }) {
  return (
    <tr>
      <td className="mono">{e.at.toFixed(3)}</td>
      <td>{e.source}</td>
      <td>{e.channel ?? ""}</td>
      <td>{e.text}</td>
    </tr>
  );
}

export function MonitorPanel({ m }: { m: Monitor }) {
  return (
    <section className="panel monitor">
      <header>
        <h1>MIDI monitor</h1>
        <div className="buttons">
          <button className={m.paused ? "on" : ""} onClick={() => m.setPaused(!m.paused)}>
            {m.paused ? "Resume" : "Pause"}
          </button>
          <button onClick={m.clear}>Clear</button>
        </div>
      </header>
      <Sources m={m} />
      <div className="log">
        <table>
          <thead><tr><th>Time (s)</th><th>From</th><th>Ch</th><th>Message</th></tr></thead>
          <tbody>{m.entries.map((e) => <Row key={e.id} e={e} />)}</tbody>
        </table>
      </div>
    </section>
  );
}
