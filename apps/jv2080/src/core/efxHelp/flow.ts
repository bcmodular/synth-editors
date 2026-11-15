// Signal flows for the EFX help: blocks, sums and the paths between them, redrawn from the facts of the diagrams in
// the JV-2080 manual (pp. 34–53). A flow is laid out on a grid: `col` left to right, `row` 0 = the left channel,
// 2 = the right channel, 1 between them (where both are summed to mono). Fractions are allowed.

import type { EfxParamDef } from "../efx";

// A node's id within its flow, and an EFX parameter's name (as in EFX_TYPES).
export type NodeId = string;
export type ParamName = string;
export type Column = number;
export type Row = number;
export type Raw = number; // a parameter's raw value
export type Shown = string; // a value as the panel shows it

export type FlowNodeKind = "in" | "out" | "sum" | "fx" | "tap";

export interface FlowNode {
  id: string;
  kind: FlowNodeKind;
  col: number;
  row: number;
  label?: string;
  params?: readonly string[]; // the parameters that shape this block
  value?: string; // a parameter whose value is shown after the label (a tap's level)
}

// A path's strength comes from its gains, multiplied: a balance's left side (D, A) or right side (W, B), a pan's
// left or right, or a level.
export type GainSide = "left" | "right";

export interface Gain {
  param: string;
  side?: GainSide;
}

// How a path is drawn:
//   hv    along the source's row, then up or down into the target (the default into a sum)
//   hvh   along, up or down, then along into the target's left (the default into a block or an output)
//   vh    out of the source a little, up or down, then along (the default out of an input)
//   line  straight, at any angle (crossing pans and taps, as the manual draws them)
//   over / under   up or down round whatever is in between, then into the target from above or below
//   loop  a feedback loop: back under (or over, `up`) the block to the sum before it, or across to the other channel
export type FlowRoute = "hv" | "hvh" | "vh" | "line" | "over" | "under" | "loop";

export interface FlowEdge {
  from: string;
  to: string;
  route?: FlowRoute;
  gains?: readonly Gain[];
  params?: readonly string[]; // values shown on the path (a loop's feedback and damping)
  up?: boolean; // a loop over the block rather than under it
  when?: { param: string; is: number }; // drawn only while that list parameter has this value
  quiet?: boolean; // no values on the path (when another path from the same block already shows them)
}

export interface Flow {
  nodes: readonly FlowNode[];
  edges: readonly FlowEdge[];
}

// --- How strongly a gain passes the signal (0…1) and how it reads on the path ---

// Pan raw 0 = L64, 64 = centre, 127 = 63R: both sides fully open at the centre, one closing towards each end.
function panGain(raw: Raw, side: GainSide): number {
  return Math.min(1, side === "left" ? (127 - raw) / 63 : raw / 64);
}

export function gainOf(p: EfxParamDef, raw: Raw, side?: GainSide): number {
  const f = raw / Math.max(1, p.max);
  if (p.kind === "pan") return panGain(raw, side ?? "left");
  if (p.kind === "balance") return side === "right" ? f : 1 - f;
  return f;
}

export function gainText(p: EfxParamDef, raw: Raw, text: Shown, side?: GainSide): string {
  if (p.kind === "balance") {
    const tag = side === "right" ? p.right : p.left;
    return `${(tag ?? "").slice(0, 1)} ${Math.round(gainOf(p, raw, side) * 100)}`;
  }
  if (p.kind === "pan") return `${side === "right" ? "R" : "L"} ${Math.round(gainOf(p, raw, side) * 100)}`;
  return valueText(p.name, text);
}

// A value on a path, with a short tag for what it is: "FB +20%", "HF 8000 Hz", "Mix 64".
const TAGS: readonly (readonly [RegExp, string])[] = [[/Feedback$/, "FB"], [/HF Damp$/, "HF"], [/^Resonance$/, "Res"], [/Mix$/, "Mix"]];
export function valueText(name: ParamName, text: Shown): string {
  const tag = TAGS.find(([re]) => re.test(name))?.[1] ?? name;
  return `${tag} ${text}`;
}

// --- Building blocks ---

type Parts = { nodes: FlowNode[]; edges: FlowEdge[] };

// A place on the grid.
export interface Place {
  col: number;
  row: number;
}
export const at = (col: Column, row: Row): Place => ({ col, row });

// What a node shows: its label, the parameters that shape it, and a value shown after the label.
type Look = Pick<FlowNode, "label" | "params" | "value">;

export const node = (id: NodeId, kind: FlowNodeKind, place: Place, look: Look = {}): FlowNode => ({ id, kind, ...place, ...look });
export const fx = (id: NodeId, place: Place, label: string, params: readonly ParamName[] = []) => node(id, "fx", place, { label, params });
export const sum = (id: NodeId, col: Column, row: Row) => node(id, "sum", at(col, row));
export const tap = (id: NodeId, place: Place, label: string, more: Look = {}) => node(id, "tap", place, { label, ...more });

export const edge = (from: NodeId, to: NodeId, more: Omit<FlowEdge, "from" | "to"> = {}): FlowEdge => ({ from, to, ...more });
export const via = (ids: readonly NodeId[], more: Omit<FlowEdge, "from" | "to"> = {}): FlowEdge[] =>
  ids.slice(1).map((id, i) => edge(ids[i]!, id, more));

export const balance = (param: ParamName, side: GainSide): Gain => ({ param, side });
export const dry = (param: ParamName): Gain => balance(param, "left");
export const wet = (param: ParamName): Gain => balance(param, "right");
export const level = (param: ParamName): Gain => ({ param });

// The right channel's row: 2 normally, 3 for types with a block on each channel ("wide"), to leave room for each
// block's feedback loop.
export const WIDE = 3;

// L in and R in, at column 0.
export function stereoIn(rRow = 2): Parts {
  return { nodes: [node("inL", "in", at(0, 0), { label: "L in" }), node("inR", "in", at(0, rRow), { label: "R in" })], edges: [] };
}

// L in and R in summed to mono at `col`.
export function monoIn(col: Column = 1): Parts {
  const p = stereoIn();
  p.nodes.push(sum("mono", col, 1));
  p.edges.push(edge("inL", "mono"), edge("inR", "mono"));
  return p;
}

// L out and R out at `col`, fed from `fromL` / `fromR` (one id for a mono source), with `gains` per side.
export function stereoOut(col: Column, fromL: NodeId, fromR: NodeId = fromL, gains: (side: GainSide) => readonly Gain[] = () => [],
  rRow = 2): Parts {
  return {
    nodes: [node("outL", "out", at(col, 0), { label: "L out" }), node("outR", "out", at(col, rRow), { label: "R out" })],
    edges: [edge(fromL, "outL", { gains: gains("left") }), edge(fromR, "outR", { gains: gains("right") })],
  };
}

// The usual end of a stereo type: L and R sums at `col` taking the dry paths (`dryL`, `dryR`) and the effect
// (`wetL`, `wetR`, often one mono block) through the balance, then (with `eq`) a 2-band EQ on each side, then the
// outputs. Extra gains on the wet paths (a pan) come from `wetGains`.
export interface MixOptions {
  col: number;
  dryL: string;
  dryR: string;
  wetL: string;
  wetR?: string;
  balance: string;
  eq?: boolean;
  rRow?: number;
  wetGains?: (side: GainSide) => readonly Gain[];
  wetRoute?: FlowRoute;
  dryRoute?: FlowRoute;
}

// The end of most types: L and R sums ("mixL", "mixR") at `col`, then (with `eq`) a 2-band EQ on each side, then
// the outputs. What feeds the sums is up to the caller.
export function mixEnd(col: Column, eq = false, rRow = 2): Parts {
  const nodes = [sum("mixL", col, 0), sum("mixR", col, rRow)];
  const edges: FlowEdge[] = [];
  let [l, r, next] = ["mixL", "mixR", col + 1];
  if (eq) {
    nodes.push(fx("eqL", at(next, 0), "EQ", ["Low Gain", "High Gain"]), fx("eqR", at(next, rRow), "EQ", ["Low Gain", "High Gain"]));
    edges.push(edge("mixL", "eqL"), edge("mixR", "eqR"));
    [l, r, next] = ["eqL", "eqR", next + 1];
  }
  const out = stereoOut(next, l, r, () => [], rRow);
  return { nodes: [...nodes, ...out.nodes], edges: [...edges, ...out.edges] };
}

export function mixOut(o: MixOptions): Parts {
  const more = (side: GainSide) => o.wetGains?.(side) ?? [];
  const end = mixEnd(o.col, o.eq, o.rRow);
  end.edges.push(
    edge(o.dryL, "mixL", { gains: [dry(o.balance)], route: o.dryRoute }),
    edge(o.dryR, "mixR", { gains: [dry(o.balance)], route: o.dryRoute }),
    edge(o.wetL, "mixL", { gains: [wet(o.balance), ...more("left")], route: o.wetRoute }),
    edge(o.wetR ?? o.wetL, "mixR", { gains: [wet(o.balance), ...more("right")], route: o.wetRoute }),
  );
  return end;
}

// A block on the mono row with its feedback sum before it, fed from `from`: [sum, block].
// A block with its feedback sum before it, fed from `from`, the loop showing `loop`'s values. With `up`, the loop
// goes over the block, so the way in comes from the side ("vh") rather than from above.
export interface FeedbackBlock {
  id: string;
  at: Place; // the sum's place; the block follows it
  label: string;
  params: readonly string[];
  from: string;
  loop: readonly string[];
  up?: boolean;
}

export function withFeedback(b: FeedbackBlock): Parts {
  const fb = `${b.id}Fb`;
  return {
    nodes: [node(fb, "sum", b.at), fx(b.id, at(b.at.col + 0.85, b.at.row), b.label, b.params)],
    edges: [edge(b.from, fb, b.up ? { route: "vh" } : {}), edge(fb, b.id), edge(b.id, fb, { route: "loop", params: b.loop, up: b.up })],
  };
}

export function join(...parts: readonly Flow[]): Flow {
  return { nodes: parts.flatMap((p) => p.nodes), edges: parts.flatMap((p) => p.edges) };
}

export const parts = (nodes: FlowNode[] = [], edges: FlowEdge[] = []): Parts => ({ nodes, edges });
