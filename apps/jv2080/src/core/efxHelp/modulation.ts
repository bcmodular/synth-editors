// Help for EFX types 11–16: the choruses and flangers.

import { at, edge, fx, join, mixOut, monoIn, parts, stereoIn, sum, WIDE, type Flow } from "./flow";
import type { EfxHelp } from "./types";

// Both channels summed into one block, its output spread to both sides through the balance.
function monoWet(label: string, params: readonly string[], eq = false): Flow {
  return join(monoIn(), parts([fx("wet", at(2.3, 1), label, params)], [edge("mono", "wet")]),
    mixOut({ col: 4, dryL: "inL", dryR: "inR", wetL: "wet", balance: "Balance", eq }));
}

// A block on each channel (with feedback loops when `loop` names the feedback), mixed with the dry sound through
// the balance, then the output EQ.
export function perChannel(label: string, params: readonly string[], loop?: readonly string[]): Flow {
  const side = (s: "L" | "R", row: number) => {
    if (!loop) return parts([fx(`fx${s}`, at(1.6, row), label, params)], [edge(`in${s}`, `fx${s}`)]);
    return parts([sum(`fb${s}`, 1.3, row), fx(`fx${s}`, at(2.2, row), label, params)],
      [edge(`in${s}`, `fb${s}`, { route: "vh" }), edge(`fb${s}`, `fx${s}`),
        edge(`fx${s}`, `fb${s}`, { route: "loop", params: loop, up: s === "L" })]);
  };
  return join(stereoIn(WIDE), side("L", 1), side("R", 2),
    mixOut({ col: loop ? 3.6 : 3, dryL: "inL", dryR: "inR", wetL: "fxL", wetR: "fxR", balance: "Balance", eq: true, rRow: WIDE }));
}

const CHORUS_FILTER = {
  "Filter Type": "A filter on the chorus sound only: OFF, LPF to darken it (cut above the cutoff) or HPF to thin it (cut below).",
  "Cutoff Freq": "Where the chorus filter cuts.",
};

export const HEXA_CHORUS: EfxHelp = {
  summary:
    "Six chorus voices at once, each with its own delay, depth and place in the stereo field, for a thick, wide " +
    "ensemble sound.",
  notes: [
    "Lush on pads and strings; the deviations are what make it sound like several players rather than one wobble.",
    "Raise Pan Deviation for width; at 0 all six voices sit in the centre.",
  ],
  params: {
    "Pre Delay": "The basic delay of the chorus voices behind the dry sound.",
    "Pre Delay Deviation": "How much the six voices' delays differ. More spreads them further apart in time.",
    "Depth Deviation": "How much the six voices' modulation depths differ.",
    "Pan Deviation": "How far apart the six voices sit in the stereo field. At 20 they are spread evenly, 60° apart.",
  },
  flow: monoWet("Hexa chorus", ["Pre Delay", "Rate", "Depth", "Pre Delay Deviation", "Depth Deviation", "Pan Deviation"]),
};

export const TREMOLO_CHORUS: EfxHelp = {
  summary: "A chorus whose output also swells up and down in level (a tremolo), with its own rate and stereo spread.",
  notes: [
    "Made for electric pianos: a slow tremolo with a gentle chorus recalls a tine piano through a stereo amp.",
    "Raise Tremolo Separation for the classic auto-pan, the sound moving from side to side.",
  ],
  params: {
    "Chorus Rate": "How fast the chorus modulates.",
    "Chorus Depth": "How far the chorus modulates.",
    "Tremolo Rate": "How fast the level swells.",
    "Tremolo Separation": "How far the tremolo moves between left and right. More gives an auto-pan.",
    "Tremolo Phase": "How far apart the left and right tremolo run.",
  },
  flow: monoWet("Tremolo chorus", ["Pre Delay", "Chorus Rate", "Chorus Depth", "Tremolo Rate", "Tremolo Separation", "Tremolo Phase"]),
};

export const SPACE_D: EfxHelp = {
  summary:
    "A multi-stage stereo chorus that adds width and shimmer without an obvious wobble, after Roland's Dimension D " +
    "studio unit.",
  notes: [
    "Use it where a normal chorus would sound seasick: on pianos, clean guitars and pads, or on a whole mix.",
    "Keep the Balance towards dry for subtle width.",
  ],
  flow: perChannel("Space-D", ["Pre Delay", "Rate", "Depth", "Phase"]),
};

export const STEREO_CHORUS: EfxHelp = {
  summary: "A stereo chorus with a filter on the chorus sound and a two-band EQ.",
  notes: [
    "The LPF on the chorus voice keeps the shimmer out of the top end, for a warmer, more vintage chorus.",
    "Phase sets the width; at 0 both sides move together and it collapses towards mono.",
  ],
  params: CHORUS_FILTER,
  flow: perChannel("Chorus", ["Filter Type", "Cutoff Freq", "Pre Delay", "Rate", "Depth", "Phase"]),
};

export const STEREO_FLANGER: EfxHelp = {
  summary:
    "A stereo flanger: a very short, swept delay with feedback, for the metallic 'jet plane' sweep. Both sides " +
    "sweep together.",
  notes: [
    "Shortest Pre Delay and high Feedback give the most dramatic jet; negative Feedback a hollower, more nasal one.",
    "Very slow Rate with high Depth makes a long sweep over a sustained pad.",
  ],
  params: {
    ...CHORUS_FILTER,
    "Filter Type": "A filter on the flanger sound only: OFF, LPF to darken it (cut above the cutoff) or HPF to thin it (cut below).",
    "Cutoff Freq": "Where the flanger filter cuts.",
    "Pre Delay": "The delay of the flanger copy behind the dry sound; very short times give the classic flanging.",
  },
  flow: perChannel("Flanger", ["Filter Type", "Cutoff Freq", "Pre Delay", "Rate", "Depth", "Phase"], ["Feedback"]),
};

export const STEP_FLANGER: EfxHelp = {
  summary:
    "A flanger whose pitch moves in steps rather than smoothly, giving a stepped, sequenced sweep. The step speed can " +
    "follow the tempo.",
  notes: [
    "Set Step Rate to a note value to lock the steps to the patch tempo (or the incoming MIDI clock, with the clock " +
      "source set to SYSTEM).",
    "High Feedback makes each step ring like a pitched tone, almost a sample-and-hold arpeggio.",
  ],
  params: {
    "Pre Delay": "The delay of the flanger copy behind the dry sound.",
    "Step Rate": "How often the pitch steps. Can be a note value, to follow the tempo.",
  },
  flow: perChannel("Step flanger", ["Pre Delay", "Rate", "Depth", "Step Rate", "Phase"], ["Feedback"]),
};
