// Help for a whole tone, from the (i) in its header: how a note becomes sound, part by part (manual p. 70, "How a
// Tone Is Organized"), and where the tone goes. Each part's own (i) goes into the detail. Built for each tone, since
// its structure is shared with its pair's other tone.

import { at, edge, fx, node, parts, tap, type Flow } from "../efxHelp/flow";
import type { SectionHelp, SectionRow } from "./types";

const ENV = (prefix: string, levels: number) => [
  ...[1, 2, 3, 4].map((i) => `${prefix}Time${i}`),
  ...Array.from({ length: levels }, (_, i) => `${prefix}Level${i + 1}`),
];
const LFOS = ["lfo1Wave", "lfo1Rate", "lfo2Wave", "lfo2Rate"];
const MAIN = 0.8; // the row of the audio path; the pair's structure sits above it, the modulation below
const MOD = 2;
const TO_MIX_OR_EFX = [0, 1]; // Output Assign MIX, EFX: the chorus and reverb sends apply

interface Pair {
  structure: string;
  other: number; // the pair's other tone, numbered from 1
}

const pairOf = (tone: number): Pair => ({ structure: tone < 2 ? "structure12" : "structure34", other: (tone ^ 1) + 1 });

function overviewFlow(pair: Pair): Flow {
  const ctl = { control: true };
  return parts([
    node("note", "in", at(0.3, MAIN), { label: "Note" }),
    tap("ranges", at(1.4, MAIN), "Ranges", { params: ["keyLower", "keyUpper", "velocityLower", "velocityUpper", "velocityFade"] }),
    tap("delay", at(2.7, MAIN), "Delay", { params: ["toneDelayMode", "toneDelayTime"], value: "toneDelayMode" }),
    { ...fx("pitch", at(4.4, MAIN), "Pitch", ["coarseTune", "fineTune"]), value: ["coarseTune", "fineTune"] },
    { ...fx("wave", at(6.15, MAIN), "Wave", ["waveNumber", "waveGain", "fxmSwitch"]), value: "waveGain" },
    { ...fx("filter", at(7.95, MAIN), "Filter", ["filterType", "cutoff", "resonance"]), value: ["filterType", "cutoff"] },
    { ...fx("amp", at(9.95, MAIN), "Amp", ["toneLevel", "tonePan"]), value: ["toneLevel", "tonePan"] },
    tap("output", at(11.55, MAIN), "Out", { params: ["outputAssign", "mixEfxSend"], value: "outputAssign" }),
    node("main", "out", at(12.6, MAIN), { label: "Mix / EFX / Direct" }),
    node("chorus", "out", at(13, 1.45), { label: "Chorus" }),
    node("reverb", "out", at(13, 2.1), { label: "Reverb" }),
    tap("pair", at(7.95, 0), `With tone ${pair.other}, type`, { params: [pair.structure], value: pair.structure }),
    tap("pitchEnv", at(4.4, MOD), "Pitch env", { params: ENV("pitchEnv", 4) }),
    tap("lfos", at(6.15, MOD), "LFO1 · LFO2", { params: LFOS }),
    tap("filterEnv", at(7.95, MOD), "Filter env", { params: ENV("filterEnv", 4) }),
    tap("ampEnv", at(9.95, MOD), "Amp env", { params: ENV("ampEnv", 3) }),
  ], [
    edge("note", "ranges", { when: { param: "toneSwitch", is: 1 } }),
    edge("ranges", "delay"), edge("delay", "pitch"), edge("pitch", "wave"), edge("wave", "filter"), edge("filter", "amp"),
    edge("amp", "output"), edge("output", "main"),
    edge("output", "chorus", { route: "vh", gains: [{ param: "chorusSend", tag: "Send" }], when: { param: "outputAssign", is: TO_MIX_OR_EFX } }),
    edge("output", "reverb", { route: "vh", gains: [{ param: "reverbSend", tag: "Send" }], when: { param: "outputAssign", is: TO_MIX_OR_EFX } }),
    edge("pair", "filter", ctl),
    edge("pitchEnv", "pitch", { ...ctl, gains: [{ param: "pitchEnvDepth", tag: "Depth" }] }),
    edge("filterEnv", "filter", { ...ctl, gains: [{ param: "filterEnvDepth", tag: "Depth" }] }),
    edge("ampEnv", "amp", ctl),
    edge("lfos", "pitch", { ...ctl, route: "line" }), edge("lfos", "filter", { ...ctl, route: "line" }), edge("lfos", "amp", { ...ctl, route: "line" }),
  ]);
}

const SEE = (part: string) => `The ${part} part's own (i) has the detail.`;

function overviewRows(tone: number, pair: Pair): SectionRow[] {
  return [
    { label: "Tone", ids: ["toneSwitch"], text: "Whether the tone plays (MUTE on its mixer strip). Tones that don't play still take polyphony while on, so turn spare ones off." },
    { label: "Wave", ids: ["waveNumber"], text: "The PCM wave everything starts from: choose it from the tone's title. Its gain and FXM are in the ⋯ in the tone's header." },
    { label: "Keys", ids: ["keyLower", "keyUpper"], text: "The keys the tone plays on, for splits (RANGES in the mixer)." },
    { label: "Velocity", ids: ["velocityLower", "velocityUpper"], text: "How hard you must play for the tone to sound, for layers; only while Velocity Ranges is on (RANGES in the mixer)." },
    { label: "Tone Delay", ids: ["toneDelayMode", "toneDelayTime"], text: "Holds back the start of the tone, for strums, echoes and back-beats (the ⋯ in the tone's header)." },
    {
      label: `Structure ${tone < 2 ? "1&2" : "3&4"}`, ids: [pair.structure],
      text: `How this tone combines with tone ${pair.other}: side by side (type 1), with the filters in series, through the booster or a ring modulator (the chip in tone ${tone < 2 ? 1 : 3}'s header).`,
    },
    { label: "Pitch", ids: ["coarseTune", "fineTune"], text: `The tone's tuning, moved by the pitch envelope and the LFOs. ${SEE("PITCH")}` },
    { label: "Filter", ids: ["filterType", "cutoff"], text: `Shapes the brightness; the filter envelope and the LFOs move its cutoff. ${SEE("FILTER")}` },
    { label: "Amp", ids: ["toneLevel"], text: `The tone's level, shaped over each note by the amp envelope and moved by the LFOs. ${SEE("AMP")}` },
    { label: "LFOs", ids: ["lfo1Wave", "lfo2Wave"], text: `Two slow oscillators the pitch, filter and amp can each use. ${SEE("LFO")}` },
    { label: "Pan", ids: ["tonePan"], text: "The tone's place in the stereo field (its mixer strip)." },
    { label: "Output", ids: ["outputAssign"], text: "Where the tone goes: MIX, through the EFX, or a direct output (its mixer strip)." },
    { label: "Sends", ids: ["chorusSend", "reverbSend"], text: "How much of the tone goes to the chorus and the reverb (its mixer strip); not with a direct output." },
  ];
}

const NOTES = [
  "Every part is shown in the copy beside this panel; each has its own (i) in the editor.",
  "Two tones on the same wave, a few cents apart with Fine, make a thicker sound than one; pan them apart for width.",
  "Splits and layers: key ranges give each tone part of the keyboard, velocity ranges let a harder touch bring in another tone.",
  "The structure decides what the pair's second tone does: with the filters in series it shapes the first tone, with ring modulation it turns both into new, metallic overtones.",
];

const helps = [0, 1, 2, 3].map((tone): SectionHelp => {
  const pair = pairOf(tone);
  return {
    title: `Tone ${tone + 1}`,
    summary:
      `How tone ${tone + 1} makes its sound: a note within its key and velocity ranges (after any tone delay) plays its ` +
      "wave at the tone's pitch, through the filter and the amp, each moved by its envelope and the LFOs, then out " +
      "to the mix, the EFX or a direct output, with sends to the chorus and reverb.",
    rows: overviewRows(tone, pair),
    notes: NOTES,
    flow: overviewFlow(pair),
    units: { coarseTune: " st", fineTune: " ¢" },
  };
});

export const toneOverviewHelp = (tone: number): SectionHelp => helps[tone]!;
