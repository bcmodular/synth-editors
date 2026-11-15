// Help for EFX types 26–40: two effects in series (→) or in parallel (/).

import {
  at, dry, edge, fx, join, level, mixEnd, monoIn, parts, stereoIn, sum, wet, WIDE, withFeedback, stereoOut, type Flow, type GainSide, type NodeId, type ParamName, type Place, type Row,
} from "./flow";
import type { EfxHelp } from "./types";

// How the notes name a stage ("chorus"), and a block's label ("Overdrive").
type StageWord = "chorus" | "flanger" | "delay";
type StageLabel = "Overdrive" | "Distortion";

// A stage after the first effect: its block's label and parameters, its balance and (for flangers and delays) the
// parameters in its feedback loop.
interface Stage {
  label: string;
  params: readonly ParamName[];
  balance: ParamName;
  loop?: readonly ParamName[];
}

const CHORUS: Stage = { label: "Chorus", params: ["Chorus Pre Delay", "Chorus Rate", "Chorus Depth"], balance: "Chorus Balance" };
const FLANGER: Stage = { label: "Flanger", params: ["FLNG Pre Delay", "FLNG Rate", "FLNG Depth"], balance: "FLNG Balance", loop: ["FLNG Feedback"] };
const DELAY: Stage = { label: "Delay", params: ["Delay Time"], balance: "Delay Balance", loop: ["Delay Feedback", "Delay HF Damp"] };

// `stage` placed at `col` on `row`, fed from `from`; returns its parts and the id of its output.
interface Placed {
  id: NodeId;
  stage: Stage;
  at: Place;
  from: NodeId;
  up?: boolean; // its feedback loop over the block
}

function placeStage({ id, stage, at: place, from, up }: Placed) {
  if (stage.loop) {
    const p = withFeedback({ id, at: place, label: stage.label, params: stage.params, from, loop: stage.loop, up });
    if (from.startsWith("in")) p.edges[0] = { ...p.edges[0]!, route: "vh" }; // from an input row, in from the side
    return p;
  }
  return parts([fx(id, at(place.col + 0.85, place.row), stage.label, stage.params)], [edge(from, id)]);
}

// --- A drive (summed to mono, then panned) into a chorus, flanger or delay ---

function driveInto(drive: "OD" | "DIST", label: StageLabel, stage: Stage): Flow {
  const pan = (side: GainSide) => ({ param: `${drive} Pan`, side });
  const into = (s: "L" | "R", side: GainSide) => [
    edge("drive", `mix${s}`, { route: "vh", gains: [dry(stage.balance), pan(side)] }),
    edge("stage", `mix${s}`, { gains: [wet(stage.balance)] }),
  ];
  return join(monoIn(), parts([fx("drive", at(2, 1), label, [`${drive} Drive`])], [edge("mono", "drive")]),
    placeStage({ id: "stage", stage, at: at(3, 1), from: "drive" }), parts([], [...into("L", "left"), ...into("R", "right")]), mixEnd(5.4));
}

const driveNotes = (stage: StageWord): string[] => [
  `The ${stage} comes after the drive, as a guitarist's pedals would be: the drive's grit is ${stage === "delay" ? "echoed" : "swept"} rather than the other way round.`,
  "Drive raises the level as well as the grit: trim Level to keep the patch balanced against others.",
];

const OD_PARAMS = { "OD Drive": "How hard the overdrive is driven. The level rises with it." };
const DIST_PARAMS = { "DIST Drive": "How hard the distortion is driven. The level rises with it." };

export const OVERDRIVE_CHORUS: EfxHelp = {
  summary: "An overdrive into a chorus: both channels are summed and overdriven, then the chorus is blended in.",
  notes: [...driveNotes("chorus"), "A classic for clean-ish rhythm guitar and for organ through a chorus amp."],
  params: OD_PARAMS,
  flow: driveInto("OD", "Overdrive", CHORUS),
};

export const OVERDRIVE_FLANGER: EfxHelp = {
  summary: "An overdrive into a flanger: both channels are summed and overdriven, then the flanger is blended in.",
  notes: [...driveNotes("flanger"), "High FLNG Feedback on a driven sound gives an aggressive, metallic sweep."],
  params: OD_PARAMS,
  flow: driveInto("OD", "Overdrive", FLANGER),
};

export const OVERDRIVE_DELAY: EfxHelp = {
  summary: "An overdrive into a delay: both channels are summed and overdriven, then the echoes are blended in.",
  notes: [...driveNotes("delay"), "The standard lead-guitar chain; Delay HF Damp around 2–4 kHz keeps the repeats from fizzing."],
  params: OD_PARAMS,
  flow: driveInto("OD", "Overdrive", DELAY),
};

export const DISTORTION_CHORUS: EfxHelp = {
  summary: "A distortion into a chorus: like OVERDRIVE→CHORUS with harder, fuzzier distortion.",
  notes: driveNotes("chorus"),
  params: DIST_PARAMS,
  flow: driveInto("DIST", "Distortion", CHORUS),
};

export const DISTORTION_FLANGER: EfxHelp = {
  summary: "A distortion into a flanger: like OVERDRIVE→FLANGER with harder, fuzzier distortion.",
  notes: driveNotes("flanger"),
  params: DIST_PARAMS,
  flow: driveInto("DIST", "Distortion", FLANGER),
};

export const DISTORTION_DELAY: EfxHelp = {
  summary: "A distortion into a delay: like OVERDRIVE→DELAY with harder, fuzzier distortion.",
  notes: [...driveNotes("delay"), "Good for synth leads as well as guitar: a little distortion and a dotted-eighth delay."],
  params: DIST_PARAMS,
  flow: driveInto("DIST", "Distortion", DELAY),
};

// --- An enhancer on each channel, then the two summed into a chorus, flanger or delay ---

function enhancerInto(stage: Stage): Flow {
  const side = (s: "L" | "R", row: number, around: "under" | "over") => parts(
    [fx(`enh${s}`, at(1.3, row), "Enhancer", ["Enhancer Sens"]), sum(`enhMix${s}`, 2.5, row)],
    [edge(`in${s}`, `enh${s}`, { route: "hv" }), edge(`enh${s}`, `enhMix${s}`, { gains: [level("Enhancer Mix")] }),
      edge(`in${s}`, `enhMix${s}`, { route: around }), edge(`enhMix${s}`, "mono"),
      edge(`enhMix${s}`, `mix${s}`, { gains: [dry(stage.balance)] }), edge("stage", `mix${s}`, { gains: [wet(stage.balance)] })],
  );
  return join(stereoIn(), side("L", 0, "under"), side("R", 2, "over"), parts([sum("mono", 3.3, 1)]),
    placeStage({ id: "stage", stage, at: at(4, 1), from: "mono" }), mixEnd(6.4));
}

const ENHANCER_PARAMS = { "Enhancer Mix": "How much of the enhancer's generated harmonics is added to the dry sound." };

export const ENHANCER_CHORUS: EfxHelp = {
  summary: "An enhancer on each channel to add presence, then the two summed into a chorus that is blended in.",
  notes: ["Brightening before the chorus makes the chorus shimmer more clearly; good on pads and electric pianos."],
  params: ENHANCER_PARAMS,
  flow: enhancerInto(CHORUS),
};

export const ENHANCER_FLANGER: EfxHelp = {
  summary: "An enhancer on each channel to add presence, then the two summed into a flanger that is blended in.",
  notes: ["The extra harmonics give the flanger more to sweep through, for a more pronounced jet."],
  params: ENHANCER_PARAMS,
  flow: enhancerInto(FLANGER),
};

export const ENHANCER_DELAY: EfxHelp = {
  summary: "An enhancer on each channel to add presence, then the two summed into a delay that is blended in.",
  notes: ["Keeps a sound defined in front of its echoes; Delay HF Damp can then darken the repeats so they sit behind it."],
  params: ENHANCER_PARAMS,
  flow: enhancerInto(DELAY),
};

// --- Two effects in series, each summed to mono and blended with the stereo signal before it ---

function series(first: Stage, second: Stage): Flow {
  const blend = (n: number, from: NodeId, dryL: NodeId, dryR: NodeId, stage: Stage) => parts([], [
    edge(dryL, `mixL${n}`, { gains: [dry(stage.balance)] }), edge(dryR, `mixR${n}`, { gains: [dry(stage.balance)] }),
    edge(from, `mixL${n}`, { gains: [wet(stage.balance)] }), edge(from, `mixR${n}`, { gains: [wet(stage.balance)] }),
  ]);
  return join(monoIn(), placeStage({ id: "first", stage: first, at: at(1.7, 1), from: "mono" }),
    parts([sum("mixL1", 4, 0), sum("mixR1", 4, 2), sum("mono2", 5, 1)], [edge("mixL1", "mono2"), edge("mixR1", "mono2")]),
    blend(1, "first", "inL", "inR", first), placeStage({ id: "second", stage: second, at: at(5.7, 1), from: "mono2" }),
    parts([sum("mixL2", 8, 0), sum("mixR2", 8, 2)]), stereoOut(9, "mixL2", "mixR2"),
    blend(2, "second", "mixL1", "mixR1", second));
}

const seriesNote = (first: StageWord, second: StageWord) =>
  `The ${second}'s balance blends what reaches it (the ${first} blend) with its own output, so D100:0W on the ${second} ` +
  `leaves the ${first} alone, and D100:0W on the ${first} sends the dry sound into the ${second}.`;

export const CHORUS_DELAY: EfxHelp = {
  summary:
    "A chorus followed by an echo. Both inputs are summed for the chorus, which is blended with the dry stereo " +
    "input; that blend is summed again for the delay, whose echoes are blended in.",
  notes: [seriesNote("chorus", "delay"), "The bread-and-butter clean-guitar and electric-piano chain: subtle chorus, a quiet echo."],
  flow: series(CHORUS, DELAY),
};

export const FLANGER_DELAY: EfxHelp = {
  summary:
    "A flanger followed by an echo. Both inputs are summed for the flanger, which is blended with the dry stereo " +
    "input; that blend is summed again for the delay, whose echoes are blended in.",
  notes: [seriesNote("flanger", "delay"), "The echoes are of the flanged sound, so a slow sweep keeps moving through each repeat."],
  flow: series(FLANGER, DELAY),
};

export const CHORUS_FLANGER: EfxHelp = {
  summary:
    "A chorus followed by a flanger. Both inputs are summed for the chorus, which is blended with the dry stereo " +
    "input; that blend is summed again for the flanger, which is blended in.",
  notes: [seriesNote("chorus", "flanger"), "Setting the two rates apart makes the combined movement less regular and more animated."],
  flow: series(CHORUS, FLANGER),
};

// --- Two effects in parallel: the first on the left input and output, the second on the right ---

function parallel(first: Stage, second: Stage): Flow {
  const side = (s: "L" | "R", row: Row, id: NodeId, stage: Stage) => join(placeStage({ id, stage, at: at(1.3, row), from: `in${s}`, up: s === "L" }), parts([], [
    edge(`in${s}`, `mix${s}`, { gains: [dry(stage.balance)] }), edge(id, `mix${s}`, { gains: [wet(stage.balance)] }),
  ]));
  const outs = join(parts([sum("mixL", 4.2, 0), sum("mixR", 4.2, WIDE)]), stereoOut(5, "mixL", "mixR", () => [], WIDE));
  return join(stereoIn(WIDE), side("L", 1, "first", first), side("R", 2, "second", second), outs);
}

const parallelNotes = (first: StageWord, second: StageWord) => [
  `The ${first} takes only the left input and reaches only the left output; the ${second} only the right. A tone ` +
    `panned to the centre goes through both; pan tones to one side to send them to one effect.`,
  `Each balance blends its own side: the ${first}'s with the dry left, the ${second}'s with the dry right.`,
];

export const CHORUS_SLASH_DELAY: EfxHelp = {
  summary: "A chorus and a delay side by side: the chorus on the left channel, the delay on the right.",
  notes: parallelNotes("chorus", "delay"),
  flow: parallel(CHORUS, DELAY),
};

export const FLANGER_SLASH_DELAY: EfxHelp = {
  summary: "A flanger and a delay side by side: the flanger on the left channel, the delay on the right.",
  notes: parallelNotes("flanger", "delay"),
  flow: parallel(FLANGER, DELAY),
};

export const CHORUS_SLASH_FLANGER: EfxHelp = {
  summary: "A chorus and a flanger side by side: the chorus on the left channel, the flanger on the right.",
  notes: parallelNotes("chorus", "flanger"),
  flow: parallel(CHORUS, FLANGER),
};
