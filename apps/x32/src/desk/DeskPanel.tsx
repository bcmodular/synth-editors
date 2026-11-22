// The desk's address, whether it answers, and what it says it is.

import { useState, type FormEvent } from "react";
import { deskProblems, socketProblem } from "../core/status";
import type { Desk } from "./useDesk";

const LINK_TEXT = { connecting: "Connecting…", connected: "Connected", unreachable: "Desk not reachable" } as const;
const LINK_CLASS = { connecting: "", connected: "good", unreachable: "bad" } as const;

const inProgress = (r: Desk["read"]): r is NonNullable<Desk["read"]> => r !== null && r.done < r.total;

function statusText(desk: Desk): string {
  const r = desk.read;
  if (desk.link === "connected" && inProgress(r)) return `Reading the desk… ${r.done} of ${r.total}`;
  return LINK_TEXT[desk.link];
}

// Addresses the desk didn't answer in the last full read: expected for anything the X32 Rack doesn't have.
function Missing({ desk }: { desk: Desk }) {
  const missing = desk.read?.missing ?? [];
  if (desk.read?.done !== desk.read?.total || missing.length === 0) return null;
  return (
    <details className="missing note">
      <summary>{missing.length} addresses didn't answer</summary>
      <p className="mono">{missing.join(" ")}</p>
    </details>
  );
}

function HostForm({ desk }: { desk: Desk }) {
  const [text, setText] = useState("");
  const [refused, setRefused] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setRefused(!(await desk.changeHost(text)));
  };
  return (
    <form className="host" onSubmit={submit}>
      <input aria-label="Desk address" placeholder={desk.host || "192.168.1.50"} value={text}
        onChange={(e) => setText(e.target.value)} />
      <button type="submit" disabled={!text.trim()}>Connect</button>
      <button type="button" onClick={() => void desk.finder.find()} disabled={desk.finder.finding}>
        {desk.finder.finding ? "Looking…" : "Find desk"}
      </button>
      {refused && <span className="bad">That isn't an address the app can use</span>}
    </form>
  );
}

// What the last search found: each desk is a button that connects to it.
function Found({ desk }: { desk: Desk }) {
  const found = desk.finder.finding ? null : desk.finder.found;
  if (!found) return null;
  if (found.length === 0) return <p className="note found">No desk answered on this network.</p>;
  return (
    <ul className="found">
      {found.map((d) => (
        <li key={d.host}>
          <button type="button" onClick={() => void desk.changeHost(d.host)} disabled={d.host === desk.host}>
            {d.name || d.model} <span className="mono">{d.host}</span> {d.model} {d.firmware}
          </button>
        </li>
      ))}
    </ul>
  );
}

function problemsOf(desk: Desk): string[] {
  if (desk.link === "unreachable" && desk.socketError) return [socketProblem(desk.socketError)];
  return desk.info ? deskProblems(desk.info) : [];
}

function Facts({ desk }: { desk: Desk }) {
  const problems = problemsOf(desk);
  return (
    <>
      <dl className="facts">
        <dt>Address</dt>
        <dd className="mono">{desk.host || "not set"}</dd>
        <dt>Status</dt>
        <dd className={LINK_CLASS[desk.link]}
          role={desk.link === "unreachable" ? "alert" : undefined}>{statusText(desk)}</dd>
        {desk.info && (
          <>
            <dt>Desk</dt>
            <dd>{desk.info.model}</dd>
            <dt>Firmware</dt>
            <dd>{desk.info.firmware}</dd>
          </>
        )}
        <dt>Values known</dt>
        <dd>{desk.cached}</dd>
      </dl>
      {problems.length > 0 && (
        <ul className="problems" role="alert">{problems.map((p) => <li key={p}>{p}</li>)}</ul>
      )}
      <Missing desk={desk} />
    </>
  );
}

export function DeskPanel({ desk }: { desk: Desk }) {
  return (
    <section className="panel desk">
      <header>
        <h1>X32 Rack</h1>
      </header>
      <HostForm desk={desk} />
      <Found desk={desk} />
      <Facts desk={desk} />
    </section>
  );
}
