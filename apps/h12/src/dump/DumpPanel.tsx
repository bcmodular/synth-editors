// The read-only dump: reads every routing, filter and mapper of the current preset, shows the rule check, and saves
// the dump as JSON.

import type { DumpState } from "./useDump";

function Rules({ d }: { d: DumpState }) {
  if (!d.dump) return null;
  return (
    <ul className="rules">
      {d.rules.map((r) => (
        <li key={r.rule} className={r.ok ? "" : "bad"}>
          {r.ok ? "✓" : "✗"} {r.rule}{r.detail && <><br /><span className="dim">{r.detail}</span></>}
        </li>
      ))}
    </ul>
  );
}

export function DumpPanel({ d }: { d: DumpState }) {
  return (
    <section className="panel dump" aria-busy={d.reading}>
      <header>
        <h1>Dump and rule check</h1>
        <div className="buttons">
          <button disabled={!d.ready || d.reading} onClick={() => void d.read()}>{d.reading ? "Reading…" : "Read all"}</button>
          <button disabled={!d.dump} onClick={d.save}>Save JSON</button>
        </div>
      </header>
      <p className="note">
        Reads every routing, channel filter, message filter and mapper of the current preset (read-only, about 170
        requests), and checks the rig's rules against them.
      </p>
      {d.problem && <p className="bad" role="alert">{d.problem}</p>}
      {d.dump && <p className="note">Read at {new Date(d.dump.savedAt).toLocaleTimeString()}.</p>}
      <Rules d={d} />
    </section>
  );
}
