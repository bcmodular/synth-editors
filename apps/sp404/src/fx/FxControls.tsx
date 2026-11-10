// The controls under an effect's view, laid out as in the designs: the SYNC switch first, then button rows,
// grids, drop-downs and note-value matrices, then the large performance buttons, then a row of knobs. A rate or
// time parameter swaps to its note-value control while SYNC is on.

import type { ReactNode } from "react";
import { displayValue, isSyncOn, paramMode, stepIndex, stepLabels, syncParam } from "../core/fx";
import type { FxDef, FxParam } from "../core/fxTypes";
import { BigButton, Drop, Grid, Knob, NoteMatrix, SegRow, type StepControlProps, type StepOption } from "./controls";
import { FX_LAYOUT } from "./fxLayout";
import { KillRow } from "./KillRow";
import type { ControlKind, ControlLayout } from "./layoutTypes";

export interface FxControlsProps {
  fx: FxDef;
  values: readonly number[];
  onValue: (index: number, raw: number) => void;
  hasView: boolean; // the effect has its own drawing: in-view parameters live there, readouts replace knobs
}

const LONG_LIST = 16; // an in-view list longer than this becomes a stepped knob until its drawing exists

function stepOptions(p: FxParam, syncOn: boolean): StepOption[] {
  const starts = paramMode(p, syncOn).starts ?? [];
  const labels = stepLabels(p, syncOn);
  return starts.map((raw, i) => ({ raw, label: labels[i] ?? String(raw) }));
}

// The control a parameter gets now: its synced control while SYNC is on, a knob when there are no steps.
export function controlFor(p: FxParam, kind: ControlKind, synced: ControlKind | undefined, syncOn: boolean): ControlKind {
  const discrete = paramMode(p, syncOn).starts !== undefined;
  const k = p.sync && syncOn && synced ? synced : kind;
  if (!discrete) return "knob";
  if (k === "knob") return "sk";
  if (k !== "inview") return k;
  return (paramMode(p, syncOn).starts?.length ?? 0) > LONG_LIST ? "sk" : "seg";
}

type Placed = { area: "rows" | "big" | "knobs" | "readouts" | "none"; node: ReactNode };

const Readout = ({ label, text }: { label: string; text: string }) => (
  <span className="readout"><span className="lbl">{label}</span><em>{text}</em></span>
);

function rowFor(kind: ControlKind, props: StepControlProps): ReactNode {
  if (kind === "drop") return <Drop {...props} />;
  if (kind === "nv" || kind === "nv8") return <NoteMatrix {...props} wide={kind === "nv8"} />;
  if (kind.startsWith("grid:")) return <Grid {...props} columns={Number(kind.slice(5))} />;
  return <SegRow {...props} />;
}

const isWide = (kind: ControlKind, count: number) =>
  kind === "nv" || kind === "nv8" || (kind === "seg" && count > 7) || (kind.startsWith("grid:") && Number(kind.slice(5)) > 6);

function place(p: FxParam, ctl: { kind: ControlKind; label?: string }, raw: number, syncOn: boolean, set: (raw: number) => void): Placed {
  const kind = ctl.kind;
  const text = displayValue(p, raw, syncOn);
  if (kind === "knob" || kind === "sk") {
    return { area: "knobs", node: <Knob label={p.label} value={raw} text={text} stepped={kind === "sk"} onChange={set} /> };
  }
  const options = stepOptions(p, syncOn);
  const index = stepIndex(paramMode(p, syncOn).starts ?? [0], raw);
  if (kind === "big") return { area: "big", node: <BigButton label={ctl.label ?? p.label} options={options} index={index} onPick={set} /> };
  const wide = isWide(kind, options.length);
  return {
    area: "rows",
    node: (
      <div className={`frow ${wide ? "col" : ""}`}>
        <span className="lbl">{p.label}</span>
        {rowFor(kind, { label: p.label, options, index, onPick: set })}
      </div>
    ),
  };
}

// With its own drawing, an effect's in-view parameters (and synced ones shown in the view) are set there.
const setInView = (ctl: ControlLayout, syncOn: boolean) => ctl.kind === "inview" || (syncOn && ctl.synced === "inview");

const NOTHING: Placed = { area: "none", node: null };

interface PlaceContext {
  fx: FxDef;
  values: readonly number[];
  onValue: (index: number, raw: number) => void;
  hasView: boolean;
  syncOn: boolean;
  readouts: ReadonlySet<number>;
}

type Slot = Placed & { first: boolean };

// Where one parameter goes: a readout, set in the drawing, or its control (the SYNC switch sorts first).
function placeParam(p: FxParam, i: number, x: PlaceContext): Slot {
  const ctl = FX_LAYOUT[x.fx.id - 1]?.controls[i] ?? { kind: "knob" as const };
  const raw = x.values[i] ?? 0;
  if (x.readouts.has(i)) {
    return { first: false, area: "readouts", node: <Readout label={p.label} text={displayValue(p, raw, x.syncOn)} /> };
  }
  if (x.hasView && setInView(ctl, x.syncOn)) return { first: false, ...NOTHING };
  const kind = ctl.kind === "sync" ? "seg" : controlFor(p, ctl.kind, ctl.synced, x.syncOn);
  return { first: ctl.kind === "sync", ...place(p, { kind, label: ctl.label }, raw, x.syncOn, (r) => x.onValue(i, r)) };
}

function Areas({ slots }: { slots: Slot[] }) {
  const area = (a: Placed["area"]) => slots.filter((x) => x.area === a).sort((x, y) => Number(y.first) - Number(x.first));
  const [rows, readouts, big, knobs] = [area("rows"), area("readouts"), area("big"), area("knobs")];
  return (
    <>
      {rows.map((x, i) => <div key={`r${i}`} className="row-slot">{x.node}</div>)}
      {readouts.length > 0 && <div className="frow readouts">{readouts.map((x) => x.node)}</div>}
      {big.length > 0 && <div className="frow">{big.map((x, i) => <span key={i} className="big-slot">{x.node}</span>)}</div>}
      {knobs.length > 0 && (
        <div className="knobs" style={{ gridTemplateColumns: `repeat(${Math.max(4, knobs.length)}, 1fr)` }}>
          {knobs.map((x, i) => <span key={i} className="knob-slot">{x.node}</span>)}
        </div>
      )}
    </>
  );
}

export function FxControls({ fx, values, onValue, hasView }: FxControlsProps) {
  const layout = FX_LAYOUT[fx.id - 1];
  const sync = syncParam(fx);
  const syncOn = sync ? isSyncOn(values[fx.params.indexOf(sync)] ?? 0) : false;
  const readouts = new Set(hasView ? (layout?.readouts ?? []) : []);
  const x: PlaceContext = { fx, values, onValue, hasView, syncOn, readouts };
  return (
    <div className="fx-controls">
      {layout?.kill && <KillRow values={values} onValue={onValue} />}
      <Areas slots={fx.params.map((p, i) => placeParam(p, i, x))} />
    </div>
  );
}
