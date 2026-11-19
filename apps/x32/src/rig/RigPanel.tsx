// What the app has worked out from the desk's names (docs/x32-spec.md, phase 1): sources and their sends,
// destinations and where they go, FX slots and their roles, spare channels, and anything that looks wrong.

import { formatDb } from "../core/faderLaw";
import { busName, stripLabel, type Destination, type FxSlot, type Rig, type Source } from "../core/rig";

// [15, 16, 25, 26, 27] → "15-16, 25-27"
export function ranges(numbers: number[]): string {
  const runs: number[][] = [];
  for (const n of numbers) {
    const last = runs.at(-1);
    if (last && last.at(-1) === n - 1) last.push(n);
    else runs.push([n]);
  }
  return runs.map((r) => (r.length > 1 ? `${r[0]}-${r.at(-1)}` : `${r[0]}`)).join(", ");
}

function SourceRow({ rig, s }: { rig: Rig; s: Source }) {
  const sends = s.sends.map((x) => `${busName(rig, x.bus)} ${formatDb(x.level)} (${x.tap})`).join(", ");
  return (
    <tr>
      <td>{s.name}</td>
      <td className="dim">{stripLabel(s)}</td>
      <td>{sends || <span className="dim">none</span>}</td>
    </tr>
  );
}

function goesTo(d: Destination): string {
  const where = [...d.outputs, ...(d.fxSlot ? [`FX ${d.fxSlot}`] : [])];
  return where.join(", ") || "nowhere";
}

function DestinationRow({ d }: { d: Destination }) {
  return (
    <tr>
      <td>{d.name}</td>
      <td className="dim">{stripLabel(d)}</td>
      <td>{goesTo(d)}</td>
      <td>{d.deviceReturn ? stripLabel(d.deviceReturn) : <span className="dim">—</span>}</td>
    </tr>
  );
}

function role(rig: Rig, f: FxSlot): string {
  if (f.role === "insert") return `insert on ${f.insertedOn.join(", ")}`;
  if (f.role === "send") return `send effect, fed by ${[...new Set(f.sourceBuses.map((b) => busName(rig, b)))].join(" / ")}`;
  return "free";
}

function FxRow({ rig, f }: { rig: Rig; f: FxSlot }) {
  return (
    <tr className={f.role}>
      <td>FX {f.slot}</td>
      <td className="dim">type {f.type}</td>
      <td>{role(rig, f)}</td>
    </tr>
  );
}

function Table({ title, head, children }: { title: string; head: string[]; children: React.ReactNode }) {
  return (
    <>
      <h2>{title}</h2>
      <table className={title.toLowerCase().replace(/\s+/g, "-")}>
        <thead><tr>{head.map((h) => <th key={h}>{h}</th>)}</tr></thead>
        <tbody>{children}</tbody>
      </table>
    </>
  );
}

export function RigPanel({ rig }: { rig: Rig }) {
  return (
    <section className="panel rig">
      <header>
        <h1>Rig</h1>
      </header>
      {rig.oddities.length > 0 && (
        <ul className="problems oddities" role="alert">{rig.oddities.map((o) => <li key={o}>{o}</li>)}</ul>
      )}
      <Table title="Sources" head={["Name", "Strip", "Sends to"]}>
        {rig.sources.map((s) => <SourceRow key={stripLabel(s)} rig={rig} s={s} />)}
      </Table>
      <Table title="Destinations" head={["Name", "Bus", "Goes to", "Returns on"]}>
        {rig.destinations.map((d) => <DestinationRow key={stripLabel(d)} d={d} />)}
      </Table>
      <Table title="FX slots" head={["Slot", "Effect", "Role"]}>
        {rig.fx.map((f) => <FxRow key={f.slot} rig={rig} f={f} />)}
      </Table>
      <p className="note spare">Spare channels: {rig.spare.length ? `ch ${ranges(rig.spare)}` : "none"}</p>
    </section>
  );
}
