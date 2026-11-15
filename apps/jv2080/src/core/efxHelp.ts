// Help for the EFX types, shown by the (i) on the EFX section: what the type does, a line for each parameter, and
// its signal flow. The words are ours; the flows are redrawn from the facts of the diagrams in the JV-2080 manual
// (pp. 33–53): which blocks, in what order, where the signal splits and mixes, and where the balances sit.

// A flow is laid out on a grid: `col` left to right (fractions allowed), `row` 0 = left channel, 1 = between
// (where both channels are summed to mono), 2 = right channel.
export type FlowNodeKind = "in" | "out" | "sum" | "fx";

export interface FlowNode {
  id: string;
  kind: FlowNodeKind;
  col: number;
  row: number;
  label?: string; // in / out / fx
  params?: readonly string[]; // the parameters that shape this block
}

// "dry" and "wet" edges carry a balance parameter's two sides (D and W); "fb" is a feedback loop, drawn under the
// row, back into a sum before its block.
export type FlowEdgeKind = "plain" | "dry" | "wet" | "fb";

export interface FlowEdge {
  from: string;
  to: string;
  kind?: FlowEdgeKind;
  params?: readonly string[]; // for dry / wet: the balance; for fb: the feedback (and anything in the loop)
}

export interface Flow {
  nodes: readonly FlowNode[];
  edges: readonly FlowEdge[];
}

export interface EfxHelp {
  summary: string;
  notes?: readonly string[];
  params: Readonly<Record<string, string>>; // by parameter name, as in EFX_TYPES
  flow: Flow;
}

// Building blocks for the flows.
const io = (id: string, kind: "in" | "out", col: number, row: number, label: string): FlowNode => ({ id, kind, col, row, label });
const sum = (id: string, col: number, row: number): FlowNode => ({ id, kind: "sum", col, row });
const fx = (id: string, col: number, label: string, params: readonly string[]): FlowNode => ({ id, kind: "fx", col, row: 1, label, params });
const edge = (from: string, to: string, kind: FlowEdgeKind = "plain", params?: readonly string[]): FlowEdge => ({ from, to, kind, params });

const BALANCE_TEXT =
  "D100:0W is the dry signal alone, D0:100W the effect alone, and D50:50W an even blend of the two.";

const FLANGER_DELAY: EfxHelp = {
  summary:
    "A flanger followed by an echo. Both inputs are summed to mono and flanged; the flanger's balance blends that with " +
    "the dry stereo input. The blend is summed to mono again for the delay, whose balance mixes its echoes back in.",
  notes: [
    "With Delay Balance at D100:0W the delay drops out and you hear the flanger alone; with FLNG Balance at D100:0W " +
      "the flanger drops out and the echoes repeat the dry sound.",
    "The echoes are of the flanged sound, so a slow flanger sweep keeps moving through each repeat.",
    "FLNG Balance and Delay Balance can be moved live by a MIDI controller (the EFX control settings).",
  ],
  params: {
    "FLNG Pre Delay": "How long after the dry sound the flanger's copy starts. The shortest times give the classic jet sweep.",
    "FLNG Rate": "How fast the flanger sweeps.",
    "FLNG Depth": "How far the flanger sweeps.",
    "FLNG Feedback":
      "How much of the flanger's output goes back into it. More gives a stronger, ringing sweep; negative values feed " +
      "it back inverted, for a hollower tone.",
    "FLNG Balance": `The blend of the dry input and the flanger that goes on to the delay. ${BALANCE_TEXT}`,
    "Delay Time": "The time to the first echo, up to half a second.",
    "Delay Feedback":
      "How much of each echo goes round again: more means more repeats. Negative values invert each repeat.",
    "Delay HF Damp":
      "Cuts the highs above this frequency each time an echo goes round, so the repeats grow darker. BYPASS keeps them bright.",
    "Delay Balance": `The blend of the delay's input and its echoes. ${BALANCE_TEXT}`,
    Level: "The output level.",
  },
  flow: {
    nodes: [
      io("inL", "in", 0, 0, "L in"),
      io("inR", "in", 0, 2, "R in"),
      sum("mono1", 1, 1),
      sum("fb1", 1.7, 1),
      fx("flanger", 2.7, "Flanger", ["FLNG Pre Delay", "FLNG Rate", "FLNG Depth"]),
      sum("mixL1", 4, 0),
      sum("mixR1", 4, 2),
      sum("mono2", 5, 1),
      sum("fb2", 5.7, 1),
      fx("delay", 6.7, "Delay", ["Delay Time"]),
      sum("mixL2", 8, 0),
      sum("mixR2", 8, 2),
      io("outL", "out", 9, 0, "L out"),
      io("outR", "out", 9, 2, "R out"),
    ],
    edges: [
      edge("inL", "mono1"),
      edge("inR", "mono1"),
      edge("mono1", "fb1"),
      edge("fb1", "flanger"),
      edge("flanger", "fb1", "fb", ["FLNG Feedback"]),
      edge("inL", "mixL1", "dry", ["FLNG Balance"]),
      edge("inR", "mixR1", "dry", ["FLNG Balance"]),
      edge("flanger", "mixL1", "wet", ["FLNG Balance"]),
      edge("flanger", "mixR1", "wet", ["FLNG Balance"]),
      edge("mixL1", "mono2"),
      edge("mixR1", "mono2"),
      edge("mono2", "fb2"),
      edge("fb2", "delay"),
      edge("delay", "fb2", "fb", ["Delay Feedback", "Delay HF Damp"]),
      edge("mixL1", "mixL2", "dry", ["Delay Balance"]),
      edge("mixR1", "mixR2", "dry", ["Delay Balance"]),
      edge("delay", "mixL2", "wet", ["Delay Balance"]),
      edge("delay", "mixR2", "wet", ["Delay Balance"]),
      edge("mixL2", "outL", "plain", ["Level"]),
      edge("mixR2", "outR", "plain", ["Level"]),
    ],
  },
};

// By raw EFX type (0–39). Filled in one type at a time.
export const EFX_HELP: Readonly<Partial<Record<number, EfxHelp>>> = {
  35: FLANGER_DELAY,
};

export const efxHelp = (type: number): EfxHelp | undefined => EFX_HELP[type];
