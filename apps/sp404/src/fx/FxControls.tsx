// The controls under an effect's view, laid out as the BCR2000's encoders (docs/sp404-design.md › Controllers ›
// BCR2000): a 3 × 2 grid with parameters 1–3 down the left and 4–6 down the right. Controls too wide for a cell (note-
// value matrices, grids, long button rows, big buttons) get a full-width row above it, and their cell shows the
// name and value, as do parameters set in the drawing. A rate or time parameter swaps to its note-value control
// while SYNC is on.

import type { ReactNode } from "react";
import { displayValue, isSyncOn, paramMode, stepIndex, stepLabels, syncParam } from "../core/fx";
import type { FxDef, FxParam } from "../core/fxTypes";
import { BigButton, Drop, Grid, Knob, NoteMatrix, SegRow, type StepControlProps, type StepOption } from "./controls";
import { FX_LAYOUT } from "./fxLayout";
import { hotProps, useHot } from "./hot";
import { SLOTS } from "../bcr/bcrMap";
import { KillRow } from "./KillRow";
import type { ControlKind, ControlLayout } from "./layoutTypes";

export interface FxControlsProps {
  fx: FxDef;
  values: readonly number[];
  onValue: (index: number, raw: number) => void;
  hasView: boolean; // the effect has its own drawing: in-view parameters live there, readouts replace knobs
  keepTuning?: KeepTuning; // Exclude tuning, for effects with tuning parameters
}

export interface KeepTuning {
  on: boolean;
  toggle: () => void;
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

// Where a parameter's control goes: in its slot's cell of the 3 × 2 grid (laid out as the BCR2000's encoders), or,
// when too wide for a cell, in a full-width row above the grid (its cell then shows the name and value).
type Placed = {
  cell: ReactNode; row?: ReactNode; big?: boolean; tuning?: boolean; keys?: readonly string[];
  slot?: number; // the parameter's slot, for CC learn's picking (data-slot)
};

const Readout = ({ label, text }: { label: string; text: string }) => (
  <span className="readout"><span className="lbl">{label}</span><em>{text}</em></span>
);

function rowFor(kind: ControlKind, props: StepControlProps): ReactNode {
  if (kind === "drop") return <Drop {...props} />;
  if (kind === "nv" || kind === "nv8") return <NoteMatrix {...props} wide={kind === "nv8"} />;
  if (kind.startsWith("grid:")) return <Grid {...props} columns={Number(kind.slice(5))} />;
  return <SegRow {...props} />;
}

const CELL_SEG = 4; // a button row this long or shorter fits in a cell

const isWide = (kind: ControlKind, count: number) =>
  kind === "nv" || kind === "nv8" || kind.startsWith("grid:") || (kind === "seg" && count > CELL_SEG);

function place(p: FxParam, kind: ControlKind, label: string | undefined, raw: number, syncOn: boolean,
  set: (raw: number) => void): Placed {
  const text = displayValue(p, raw, syncOn);
  if (kind === "knob" || kind === "sk") {
    return { cell: <Knob label={p.label} value={raw} text={text} stepped={kind === "sk"} onChange={set} /> };
  }
  const options = stepOptions(p, syncOn);
  const index = stepIndex(paramMode(p, syncOn).starts ?? [0], raw);
  const readout = <Readout label={p.label} text={text} />;
  if (kind === "big") {
    return { cell: readout, big: true, row: <BigButton label={label ?? p.label} options={options} index={index} onPick={set} /> };
  }
  const control = rowFor(kind, { label: p.label, options, index, onPick: set });
  if (!isWide(kind, options.length)) return { cell: <span className="frow col"><span className="lbl">{p.label}</span>{control}</span> };
  return { cell: readout, row: <div className="frow col"><span className="lbl">{p.label}</span>{control}</div> };
}

// With its own drawing, an effect's in-view parameters (and synced ones shown in the view) are set there.
export const setInView = (ctl: ControlLayout, syncOn: boolean) => ctl.kind === "inview" || (syncOn && ctl.synced === "inview");

interface PlaceContext {
  fx: FxDef;
  values: readonly number[];
  onValue: (index: number, raw: number) => void;
  hasView: boolean;
  syncOn: boolean;
  readouts: ReadonlySet<number>;
}

// Set in the drawing (or a readout under it): its cell shows the name and value.
const shownAsReadout = (ctl: ControlLayout, i: number, x: PlaceContext) =>
  x.readouts.has(i) || (x.hasView && setInView(ctl, x.syncOn));

// One parameter: a readout when it's set in the drawing, else its control.
function placeParam(p: FxParam, i: number, x: PlaceContext): Placed {
  const ctl = FX_LAYOUT[x.fx.id - 1]?.controls[i] ?? { kind: "knob" as const };
  const raw = x.values[i] ?? 0;
  if (shownAsReadout(ctl, i, x)) {
    return { cell: <Readout label={p.label} text={displayValue(p, raw, x.syncOn)} /> };
  }
  const kind = ctl.kind === "sync" ? "seg" : controlFor(p, ctl.kind, ctl.synced, x.syncOn);
  return place(p, kind, ctl.label, raw, x.syncOn, (r) => x.onValue(i, r));
}

// KEEP TUNING (Exclude tuning) sits just above the effect's first tuning control: above its row when it has one
// (Resonator: above CHORD), else above the grid.
function KeepTuningRow({ keep }: { keep: KeepTuning }) {
  return (
    <div className="keeprow">
      <button className={`keep ${keep.on ? "on" : ""}`} aria-pressed={keep.on} onClick={keep.toggle}
        title="Exclude tuning: preset recall and morph leave the tuning parameters alone">
        KEEP TUNING
      </button>
    </div>
  );
}

// Where KEEP TUNING goes: above the row of the first parameter that is a tuning one, above the big buttons when
// that's one of them, else above the grid.
type KeepAt = Placed | "big" | "grid" | undefined;

function keepPlace(placed: Placed[], keep: KeepTuning | undefined): KeepAt {
  const tuning = keep && placed.find((x) => x.tuning);
  if (!tuning) return undefined;
  if (tuning.big) return "big";
  return tuning.row ? tuning : "grid";
}

// Wide rows, then big buttons side by side, then the six cells (slots 1–3 down the left, 4–6 down the right), with
// KEEP TUNING above the first of them that holds a tuning parameter.
function Slots({ placed, keep }: { placed: Placed[]; keep?: KeepTuning }) {
  const hot = useHot();
  const lit = (x: Placed | undefined, className: string) =>
    ({ ...hotProps(hot, x?.keys ?? [], className), "data-slot": x?.slot });
  const rows = placed.filter((x) => x.row && !x.big);
  const big = placed.filter((x) => x.big);
  const keepAt = keepPlace(placed, keep);
  const keepRow = (at: KeepAt) => keep && keepAt === at && <KeepTuningRow keep={keep} />;
  return (
    <>
      {rows.map((x, i) => (
        <div key={`r${i}`} className="row-slot">{keepRow(x)}<div {...lit(x, "row-ctl")}>{x.row}</div></div>
      ))}
      {keepRow("big")}
      {big.length > 0 && (
        <div className="frow">{big.map((x, i) => <span key={i} {...lit(x, "big-slot")}>{x.row}</span>)}</div>
      )}
      {keepRow("grid")}
      <div className="slots">
        {Array.from({ length: SLOTS }, (_, i) => <div key={i} {...lit(placed[i], "slot")}>{placed[i]?.cell}</div>)}
      </div>
    </>
  );
}

export function FxControls({ fx, values, onValue, hasView, keepTuning }: FxControlsProps) {
  const layout = FX_LAYOUT[fx.id - 1];
  const sync = syncParam(fx);
  const syncOn = sync ? isSyncOn(values[fx.params.indexOf(sync)] ?? 0) : false;
  const readouts = new Set(hasView ? (layout?.readouts ?? []) : []);
  const x: PlaceContext = { fx, values, onValue, hasView, syncOn, readouts };
  return (
    <div className="fx-controls">
      {layout?.kill && <KillRow values={values} onValue={onValue} />}
      <Slots placed={fx.params.map((p, i) => ({ ...placeParam(p, i, x), tuning: p.tuning, keys: [p.key], slot: i }))}
        keep={keepTuning} />
    </div>
  );
}
