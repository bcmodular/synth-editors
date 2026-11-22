// Set up from the rig file: check the desk against apps/x32/rig/studio.json (reads only), see every difference by
// area, then apply the areas you tick. A backup scene is saved before the first write.

import { useEffect, useState } from "react";
import { show, type Change, type SetupPlan } from "../core/setupPlan";
import type { SetupResult } from "../core/setup";
import { AREAS, type Area } from "../core/targets";
import type { Desk } from "../desk/useDesk";
import type { Setup, SetupState } from "./useSetup";

const AREA_TITLE: Record<Area, string> = {
  routing: "Input routing", channels: "Channels", buses: "Buses", outputs: "Outputs", fx: "FX feeds", card: "USB card",
};

function ChangeList({ changes }: { changes: Change[] }) {
  return (
    <ul className="changes">
      {changes.map((c) => (
        <li key={c.param.address}>
          {c.what} <span className="dim">({show(c.from, c.param.type)} → {show(c.value, c.param.type)})</span>
        </li>
      ))}
    </ul>
  );
}

function AreaRow({ area, changes, on, toggle }: { area: Area; changes: Change[]; on: boolean; toggle: () => void }) {
  return (
    <details className="area" data-area={area}>
      <summary>
        <label onClick={(e) => e.stopPropagation()}>
          <input type="checkbox" checked={on} onChange={toggle} /> {AREA_TITLE[area]}
        </label>
        <span className="dim"> {changes.length} {changes.length === 1 ? "change" : "changes"}</span>
      </summary>
      <ChangeList changes={changes} />
    </details>
  );
}

function Manual({ steps }: { steps: string[] }) {
  if (!steps.length) return null;
  return (
    <>
      <h2>By hand</h2>
      <ul className="manual">{steps.map((s) => <li key={s}>{s}</li>)}</ul>
    </>
  );
}

function Plan({ plan, apply }: { plan: SetupPlan; apply: (areas: Area[]) => void }) {
  const withChanges = AREAS.filter((a) => plan.byArea[a].length);
  const [chosen, setChosen] = useState<Set<Area>>(() => new Set(withChanges));
  useEffect(() => setChosen(new Set(AREAS.filter((a) => plan.byArea[a].length))), [plan]);
  const toggle = (a: Area) => setChosen((s) => new Set(s.has(a) ? [...s].filter((x) => x !== a) : [...s, a]));
  const count = withChanges.filter((a) => chosen.has(a)).reduce((n, a) => n + plan.byArea[a].length, 0);
  if (!withChanges.length) {
    return <p className="note good matches">The desk matches the rig file ({plan.unchanged} settings checked).</p>;
  }
  return (
    <>
      <p className="note">{plan.changes.length} settings differ from the rig file; {plan.unchanged} already match.</p>
      {withChanges.map((a) => <AreaRow key={a} area={a} changes={plan.byArea[a]} on={chosen.has(a)} toggle={() => toggle(a)} />)}
      <div className="apply">
        <button type="button" disabled={!count} onClick={() => apply(withChanges.filter((a) => chosen.has(a)))}>
          Apply {count} changes
        </button>
        <span className="dim">Saves the desk to a backup scene first.</span>
      </div>
      <Manual steps={plan.manual} />
    </>
  );
}

function Result({ result }: { result: SetupResult }) {
  const first = result.mismatches[0];
  if (first) {
    return (
      <p className="note bad" role="alert">
        Stopped after {result.written} of {result.total}: {first.change.what} reads back as {show(first.got, first.change.param.type)}, not{" "}
        {show(first.change.value, first.change.param.type)}. The desk as it was is in scene {result.backup}; load it to go back.
      </p>
    );
  }
  return (
    <p className="note good result">
      Applied {result.written} changes, all read back. Before: scene {result.backup}. After: scene {result.base},
      "Studio base".
    </p>
  );
}

function Body({ state, setup }: { state: SetupState; setup: Setup }) {
  switch (state.kind) {
    case "idle":
      return <p className="note">Reads the desk and lists what differs from the rig file. Nothing is written.</p>;
    case "checking":
      return <p className="note">Reading the desk… {state.done} of {state.total}</p>;
    case "planned":
      return <Plan plan={state.plan} apply={setup.apply} />;
    case "applying":
      return <p className="note">Writing… {state.written} of {state.total}</p>;
    case "done":
      return <Result result={state.result} />;
    case "error":
      return <p className="note bad" role="alert">{state.message}</p>;
  }
}

export function SetupPanel({ desk, setup }: { desk: Desk; setup: Setup }) {
  const busy = setup.state.kind === "checking" || setup.state.kind === "applying";
  return (
    <section className="panel setup">
      <header>
        <h1>Set up from rig file</h1>
        <button type="button" disabled={busy || desk.link !== "connected"} onClick={() => void setup.check()}>
          Check against rig file
        </button>
      </header>
      <Body state={setup.state} setup={setup} />
    </section>
  );
}
