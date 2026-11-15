// Help for a tone's sections: pitch, filter, amp and LFOs. A tone is a wave (WG) through a filter (TVF) and an
// amplifier (TVA); each has an envelope, and two LFOs can modulate all three (manual p. 70).

import { at, edge, fx, node, parts, sum, tap, join, type Flow, type Gain, type NodeId } from "../efxHelp/flow";
import type { SectionHelp, SectionRow } from "./types";

const ENV_IDS = (prefix: string, levels: number) => [
  ...[1, 2, 3, 4].map((i) => `${prefix}Time${i}`),
  ...Array.from({ length: levels }, (_, i) => `${prefix}Level${i + 1}`),
];

const depth = (param: string, tag: string): Gain => ({ param, tag });

// The audio path along the top (`chain`), and its modulation summed into the block `target` from below: the
// envelope (with its depth, if it has one) and the two LFOs, as dashed control paths.
interface Modulated {
  chain: readonly { id: NodeId; label: string; params?: readonly string[]; value?: string }[];
  target: NodeId;
  env: { label: string; ids: readonly string[]; depth?: string };
  lfos: readonly [string, string];
}

function modulatedFlow({ chain, target, env, lfos }: Modulated): Flow {
  const col = (i: number) => 0.2 + i * 1.25;
  const blocks = chain.map((b, i) => (b.id === "in" || b.id === "out"
    ? node(b.id, b.id, at(col(i), 0), { label: b.label })
    : fx(b.id, at(col(i), 0), b.label, b.params)));
  chain.forEach((b, i) => { if (b.value) blocks[i] = { ...blocks[i]!, value: b.value }; });
  const tcol = chain.findIndex((b) => b.id === target);
  const mod = sum("mod", col(tcol), 1);
  const sources = [
    tap("env", at(col(tcol) - 1.3, 2), env.label, { params: env.ids }),
    tap("lfo1", at(col(tcol), 2), "LFO1", { params: [lfos[0]] }),
    tap("lfo2", at(col(tcol) + 1.3, 2), "LFO2", { params: [lfos[1]] }),
  ];
  const ctl = { route: "line" as const, control: true };
  return join(parts([...blocks, mod, ...sources], [
    ...chain.slice(1).map((b, i) => edge(chain[i]!.id, b.id)),
    edge("mod", target, { control: true, route: "hv" }),
    edge("env", "mod", { ...ctl, gains: env.depth ? [depth(env.depth, "Depth")] : [] }),
    edge("lfo1", "mod", { ...ctl, gains: [depth(lfos[0], "Depth")] }),
    edge("lfo2", "mod", { ...ctl, gains: [depth(lfos[1], "Depth")] }),
  ]));
}

const lfoRow = (n: 1 | 2, what: string, effect: string): SectionRow => ({
  label: `LFO${n}`,
  ids: [`${what}Lfo${n}`],
  text: `How much LFO${n} moves the ${effect}. Negative values move it the other way, so two tones (or both LFOs) can ` +
    `be set against each other.`,
});

const ENVELOPE_DRAG = "Drag the points in the graph; the button at the top right returns it to a simple shape.";

export const PITCH_HELP: SectionHelp = {
  title: "Pitch",
  summary:
    "The tone's tuning, and what moves its pitch while it plays: the pitch envelope (once per note) and the two " +
    "LFOs (continuously, for vibrato).",
  rows: [
    { label: "Coarse", ids: ["coarseTune"], text: "The tone's pitch in semitones, up to four octaves up or down." },
    { label: "Fine", ids: ["fineTune"], text: "Fine tuning in cents (hundredths of a semitone), up to half a semitone either way." },
    { label: "Env", ids: ["pitchEnvDepth"], text: "How far the pitch envelope moves the pitch. Negative values turn the envelope upside down." },
    {
      label: "Envelope", ids: ENV_IDS("pitchEnv", 4), noValue: true,
      text: "Four times and four levels. From the tuned pitch the note moves through levels 1–3 while the key is " +
        `held, and to level 4 after it's released; levels are above or below the tuned pitch. ${ENVELOPE_DRAG}`,
    },
    lfoRow(1, "pitch", "pitch (vibrato)"),
    lfoRow(2, "pitch", "pitch"),
  ],
  notes: [
    "A few cents of Fine between two tones playing the same wave gives a slow, natural beating, thicker than one tone.",
    "A quick pitch blip at the start of each note (a short time 1 to a high level 1, back to 0) adds bite to brass, " +
      "plucks and synth leads; a negative drop gives drum-like pitch sweeps.",
    "Coarse +7 or +12 on a second tone gives a fifth or an octave layered on every note.",
    "The JV also has Random Pitch Depth, Pitch Keyfollow and velocity control of the envelope; this editor doesn't " +
      "show them yet.",
  ],
  flow: modulatedFlow({
    chain: [
      { id: "in", label: "Key" },
      { id: "tune", label: "Tuning", params: ["coarseTune", "fineTune"], value: "coarseTune" },
      { id: "wave", label: "Wave", params: [] },
      { id: "out", label: "to the filter" },
    ],
    target: "wave",
    env: { label: "Pitch env", ids: ENV_IDS("pitchEnv", 4), depth: "pitchEnvDepth" },
    lfos: ["pitchLfo1", "pitchLfo2"],
  }),
};

export const FILTER_HELP: SectionHelp = {
  title: "Filter",
  summary:
    "The filter shapes the tone's brightness by cutting part of its frequency range. Its cutoff can move with the " +
    "filter envelope (once per note) and the two LFOs.",
  rows: [
    {
      label: "Type", ids: ["filterType"],
      text: "OFF no filter; LPF cuts above the cutoff (mellower, the usual choice); BPF keeps only a band around it; " +
        "HPF cuts below it (thinner, brighter); PKG boosts a band around it, for wah-like sounds.",
    },
    { label: "Cutoff", ids: ["cutoff"], text: "Where the filter acts. With LPF lower is darker; with HPF higher is thinner." },
    { label: "Resonance", ids: ["resonance"], text: "Emphasis at the cutoff, for a more pronounced, vocal filter. Very high values ring and can distort." },
    { label: "Env", ids: ["filterEnvDepth"], text: "How far the filter envelope moves the cutoff. Negative values turn it upside down." },
    {
      label: "Envelope", ids: ENV_IDS("filterEnv", 4), noValue: true,
      text: "Four times and four levels: the cutoff moves through levels 1–3 while the key is held and to level 4 " +
        `after it's released, relative to the Cutoff setting. ${ENVELOPE_DRAG}`,
    },
    lfoRow(1, "filter", "cutoff (a wah or sweep)"),
    lfoRow(2, "filter", "cutoff"),
  ],
  notes: [
    "For a plucked or synth-bass sound: LPF, a fairly low cutoff, some resonance, and a positive envelope with a " +
      "fast time 1 and a short decay, so each note opens and closes.",
    "PKG with an LFO on the cutoff makes an auto-wah; S&H on that LFO gives the random, stepping 'computer' filter.",
    "On one-shot waves (pianos, drums) the wave's own attack carries the character: let the envelope shape the decay " +
      "rather than the attack.",
    "The JV also has Cutoff Keyfollow (brighter higher up the keyboard), Resonance and envelope velocity " +
      "sensitivity; this editor doesn't show them yet.",
  ],
  flow: modulatedFlow({
    chain: [
      { id: "in", label: "Wave" },
      { id: "filter", label: "Filter", params: ["filterType", "cutoff", "resonance"], value: "filterType" },
      { id: "out", label: "to the amp" },
    ],
    target: "filter",
    env: { label: "Filter env", ids: ENV_IDS("filterEnv", 4), depth: "filterEnvDepth" },
    lfos: ["filterLfo1", "filterLfo2"],
  }),
};

export const AMP_HELP: SectionHelp = {
  title: "Amp",
  summary:
    "The amplifier sets the tone's level over each note with the amp envelope, and the two LFOs can make it swell " +
    "and fall (tremolo). The tone's level and pan are on its mixer strip.",
  rows: [
    {
      label: "Envelope", ids: ENV_IDS("ampEnv", 3), noValue: true,
      text: "Four times and three levels: the attack (time 1), the fall through levels 2 and 3 while the key is " +
        `held, and the release (time 4) to silence. ${ENVELOPE_DRAG}`,
    },
    lfoRow(1, "amp", "level (tremolo)"),
    lfoRow(2, "amp", "level"),
    { label: "Level", ids: ["toneLevel"], text: "The tone's level, on its mixer strip: how loud it is against the other tones." },
    { label: "Pan", ids: ["tonePan"], text: "The tone's place in the stereo field, on its mixer strip." },
  ],
  notes: [
    "With a looping wave (organs, strings, pads) the envelope shapes the whole note. With a one-shot wave (drums, " +
      "plucks) the wave's own decay ends the note, however long the envelope is.",
    "A slow attack (time 1) turns a plucked wave into a bowed or swelling sound; a short release (time 4) keeps fast " +
      "parts clean, a long one lets notes ring on.",
    "The same LFO depth positive on one tone and negative on another, with the two panned apart, makes them " +
      "alternate: an auto-pan.",
    "The JV also has velocity sensitivity and curves for this envelope, and level bias across the keyboard; this " +
      "editor doesn't show them yet.",
  ],
  flow: modulatedFlow({
    chain: [
      { id: "in", label: "Filter" },
      { id: "amp", label: "Amp", params: ["toneLevel", "tonePan"], value: "toneLevel" },
      { id: "out", label: "to the mixer" },
    ],
    target: "amp",
    env: { label: "Amp env", ids: ENV_IDS("ampEnv", 3) },
    lfos: ["ampLfo1", "ampLfo2"],
  }),
};

const LFO_WAVES =
  "The shape it repeats: TRI triangle, SIN sine, SAW sawtooth, SQR square, TRP trapezoid, S&H sample and hold " +
  "(random steps), RND random (smooth), CHS chaos.";

const TARGETS = [["pitch", "Pitch", 0], ["filter", "Filter", 1], ["amp", "Amp", 2]] as const;

function lfoFlow(): Flow {
  const lfo = (n: 1 | 2, row: number) => fx(`lfo${n}`, at(0.6, row), `LFO${n}`, [`lfo${n}Wave`, `lfo${n}Rate`]);
  const nodes = [{ ...lfo(1, 0.5), value: "lfo1Wave" }, { ...lfo(2, 1.5), value: "lfo2Wave" },
    ...TARGETS.map(([id, label, row]) => tap(id, at(3.6, row), label, { params: [`${id}Lfo1`, `${id}Lfo2`] }))];
  const edges = ([1, 2] as const).flatMap((n) => TARGETS.map(([id]) =>
    edge(`lfo${n}`, id, { route: "line", control: true, quiet: true, gains: [depth(`${id}Lfo${n}`, "Depth")] })));
  return join(parts(nodes, edges));
}

export const LFO_HELP: SectionHelp = {
  title: "LFOs",
  summary:
    "Two low-frequency oscillators: slow, repeating movements that the pitch, filter and amp sections can each use " +
    "(vibrato, wah, tremolo). Here you set their shape and speed; how much each moves what is set in those sections.",
  rows: [
    { label: "LFO1 wave", ids: ["lfo1Wave"], text: LFO_WAVES },
    { label: "LFO1 rate", ids: ["lfo1Rate"], text: "How fast LFO1 repeats." },
    { label: "LFO2 wave", ids: ["lfo2Wave"], text: LFO_WAVES },
    { label: "LFO2 rate", ids: ["lfo2Rate"], text: "How fast LFO2 repeats." },
    ...TARGETS.flatMap(([id, label]) => [1, 2].map((n) => ({
      label: `${label} LFO${n}`, ids: [`${id}Lfo${n}`], text: `How much LFO${n} moves the ${label.toLowerCase()} (set in the ${label.toUpperCase()} section).`,
    }))),
  ],
  notes: [
    "Two LFOs at slightly different rates on the same target give a less regular, more organic movement.",
    "S&H on the filter is the classic random burble; SQR on the pitch makes a trill.",
    "CHS (chaos) ignores Rate.",
    "On the JV each LFO also has a delay and fade (so vibrato can creep in after the note starts), key sync, an " +
      "offset and tempo sync; this editor doesn't show them yet.",
  ],
  flow: lfoFlow(),
};
