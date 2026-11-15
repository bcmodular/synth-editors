// Help for EFX types 1–10: EQ, drive, phaser, spectrum, enhancer, auto-wah, rotary and dynamics.

import { at, edge, fx, join, level, monoIn, parts, stereoIn, stereoOut, sum, via, withFeedback, type Flow, type GainSide } from "./flow";
import type { EfxHelp } from "./types";

const pan = (side: GainSide) => [{ param: "Pan", side }];
const EQ = ["Low Gain", "High Gain"];

// Both channels summed to mono, through `blocks` in a row, then panned to L and R by `panned` (or straight).
function monoChain(blocks: readonly { id: string; label: string; params: readonly string[] }[], panned = true): Flow {
  const chain = parts(blocks.map((b, i) => fx(b.id, at(2 + i * 1.1, 1), b.label, b.params)), via(["mono", ...blocks.map((b) => b.id)]));
  const last = blocks[blocks.length - 1]!.id;
  return join(monoIn(), chain, stereoOut(2.6 + blocks.length * 1.1, last, last, panned ? pan : () => []));
}

const ampChain = (label: string) =>
  monoChain([{ id: "drive", label, params: ["Drive"] }, { id: "amp", label: "Amp", params: ["Amp Type"] }, { id: "eq", label: "EQ", params: EQ }]);

const AMP_TYPE =
  "The guitar amp the drive goes through: SMALL a small combo, BUILT-IN an amp with its speaker built in, 2-STACK and " +
  "3-STACK big stacks, darker and fuller.";

export const STEREO_EQ: EfxHelp = {
  summary:
    "A four-band EQ on each channel: a low shelf, two peaks and a high shelf. Both channels share the same settings.",
  notes: [
    "Cut before you boost: taking out a muddy or harsh band usually sounds better than boosting around it.",
    "A narrow peak (high Q) swept with plenty of gain helps find a problem frequency; then cut it.",
  ],
  params: {
    "Low Freq": "Where the low shelf starts: 200 or 400 Hz.",
    "Low Gain": "Boost or cut below the low frequency.",
    "High Freq": "Where the high shelf starts: 4 or 8 kHz.",
    "High Gain": "Boost or cut above the high frequency.",
    "P1 Freq": "The centre of the first peak.",
    "P1 Q": "The width of the first peak: higher is narrower.",
    "P1 Gain": "Boost or cut at the first peak.",
    "P2 Freq": "The centre of the second peak.",
    "P2 Q": "The width of the second peak: higher is narrower.",
    "P2 Gain": "Boost or cut at the second peak.",
  },
  flow: join(stereoIn(), parts([
    fx("eqL", at(1.6, 0), "4-band EQ", ["Low Freq", "Low Gain", "P1 Freq", "P1 Q", "P1 Gain", "P2 Freq", "P2 Q", "P2 Gain", "High Freq", "High Gain"]),
    fx("eqR", at(1.6, 2), "4-band EQ", ["Low Freq", "Low Gain", "P1 Freq", "P1 Q", "P1 Gain", "P2 Freq", "P2 Q", "P2 Gain", "High Freq", "High Gain"]),
  ], [edge("inL", "eqL"), edge("inR", "eqR")]), stereoOut(3.2, "eqL", "eqR")),
};

export const OVERDRIVE: EfxHelp = {
  summary:
    "A warm, valve-like overdrive into a guitar amp model and a two-band EQ. The two channels are summed to mono first, " +
    "so Pan places the result.",
  notes: [
    "For organ, lower Drive values give the growl of an overdriven rotary-speaker amp; pair it with the chorus or reverb sends.",
    "Drive raises the level as well as the grit: trim Level to keep the patch balanced against others.",
  ],
  params: { "Amp Type": AMP_TYPE },
  flow: ampChain("Overdrive"),
};

export const DISTORTION: EfxHelp = {
  summary:
    "A harder, fuzzier distortion than OVERDRIVE, into the same amp model and two-band EQ. The two channels are summed " +
    "to mono first, so Pan places the result.",
  notes: [
    "Distortion turns chords into mush; it works best on single-note leads and basses.",
    "Cut Low Gain to tighten a distorted bass, and use High Gain sparingly: the top end gets fizzy quickly.",
  ],
  params: { "Amp Type": AMP_TYPE },
  flow: ampChain("Distortion"),
};

export const PHASER: EfxHelp = {
  summary:
    "A phaser: a copy of the sound with its phase swept against the original, so moving notches sweep through the " +
    "spectrum. The channels are summed to mono, so Pan places the result.",
  notes: [
    "A slow phaser on electric piano or string machine patches is a classic 70s sound.",
    "Mix at full and Resonance high give the most pronounced, vocal sweep.",
  ],
  params: {
    Manual: "The centre frequency the sweep moves around.",
    Rate: "How fast the phaser sweeps.",
    Depth: "How far the phaser sweeps.",
    Resonance: "How much of the phaser's output is fed back into it. More gives sharper, more ringing notches.",
    Mix: "How much of the phase-shifted sound is added to the dry sound. The notches come from mixing the two.",
  },
  flow: join(monoIn(), withFeedback({ id: "phaser", at: at(1.8, 1), label: "Phaser", params: ["Manual", "Rate", "Depth"], from: "mono", loop: ["Resonance"] }),
    parts([sum("phMix", 4, 1)], [edge("phaser", "phMix", { gains: [level("Mix")] }), edge("mono", "phMix", { route: "over" })]),
    stereoOut(5, "phMix", "phMix", pan)),
};

export const SPECTRUM: EfxHelp = {
  summary:
    "Eight boosts or cuts at fixed frequencies (250 Hz to 8 kHz) with one shared width. Like a graphic EQ, but the " +
    "bands are placed for character rather than correction.",
  notes: [
    "Boosting two or three bands between 500 Hz and 2 kHz gives a vowel-like, nasal or telephone character.",
    "With a narrow Q, alternate boosts and cuts give a comb-like, hollow tone.",
  ],
  params: {
    Band1: "Boost or cut at 250 Hz.",
    Band2: "Boost or cut at 500 Hz.",
    Band3: "Boost or cut at 1 kHz.",
    Band4: "Boost or cut at 1.25 kHz.",
    Band5: "Boost or cut at 2 kHz.",
    Band6: "Boost or cut at 3.15 kHz.",
    Band7: "Boost or cut at 4 kHz.",
    Band8: "Boost or cut at 8 kHz.",
    Q: "The width of all eight bands: higher is narrower.",
  },
  flow: monoChain([{ id: "spectrum", label: "Spectrum", params: ["Band1", "Band2", "Band3", "Band4", "Band5", "Band6", "Band7", "Band8", "Q"] }]),
};

// An enhancer on each channel, its harmonics mixed in beside the dry sound, then the EQ.
function enhancerFlow(): Flow {
  const side = (s: "L" | "R", row: number, around: "under" | "over") => parts(
    [fx(`enh${s}`, at(1.3, row), "Enhancer", ["Sens"]), sum(`mix${s}`, 2.6, row), fx(`eq${s}`, at(3.6, row), "EQ", EQ)],
    [edge(`in${s}`, `enh${s}`, { route: "hv" }), edge(`enh${s}`, `mix${s}`, { gains: [level("Mix")] }), edge(`in${s}`, `mix${s}`, { route: around }),
      edge(`mix${s}`, `eq${s}`)],
  );
  return join(stereoIn(), side("L", 0, "under"), side("R", 2, "over"), stereoOut(4.7, "eqL", "eqR"));
}

export const ENHANCER: EfxHelp = {
  summary:
    "An exciter: it generates new high harmonics from the sound and mixes them in, for more presence and definition " +
    "without simply turning up the treble.",
  notes: [
    "A little goes a long way; too much sounds brittle and harsh, especially on already bright sounds.",
    "Good for helping dull, older-sounding waves (pianos, strings) cut through a mix.",
  ],
  params: { Mix: "How much of the generated harmonics is added to the dry sound." },
  flow: enhancerFlow(),
};

export const AUTO_WAH: EfxHelp = {
  summary:
    "A filter that sweeps up and down, either by itself (Rate and Depth) or following how hard you play (Sens), like a wah pedal.",
  notes: [
    "For a funky touch-wah on clav or bass, raise Sens and keep Depth low so your playing drives the filter.",
    "Set Depth to 0 and use Manual alone for a fixed, 'cocked wah' tone.",
  ],
  params: {
    "Filter Type": "LPF sweeps over a wide range for a smoother wah; BPF a narrow band for a sharper, more vocal one.",
    Sens: "How much the playing level moves the filter.",
    Manual: "The centre frequency the wah moves around.",
    Peak: "How sharp the filter's resonance is. Higher is narrower and more pronounced.",
    Rate: "How fast the wah sweeps by itself.",
    Depth: "How far the wah sweeps by itself.",
  },
  flow: monoChain([{ id: "wah", label: "Auto wah", params: ["Filter Type", "Sens", "Manual", "Peak", "Rate", "Depth"] }], false),
};

// The horn and the drum, each heard on both sides (the cabinet's two microphones).
function rotaryFlow(): Flow {
  const horn = ["Speed", "High Slow Rate", "High Fast Rate", "High Acceleration"];
  const drum = ["Speed", "Low Slow Rate", "Low Fast Rate", "Low Acceleration"];
  const rotors = parts([fx("high", at(2.6, 0.45), "Horn", horn), fx("low", at(2.6, 1.55), "Drum", drum)], [edge("mono", "high"), edge("mono", "low")]);
  const outs = stereoOut(4.4, "high", "high", () => [level("High Level")]);
  outs.edges.push(edge("low", "outL", { gains: [level("Low Level")], quiet: true }), edge("low", "outR", { gains: [level("Low Level")] }));
  outs.edges[1]!.quiet = true; // the horn's level shows on its path to the left, the drum's on its path to the right
  for (const e of outs.edges) e.route = "line";
  return join(monoIn(), rotors, outs);
}

export const ROTARY: EfxHelp = {
  summary:
    "A rotating-speaker cabinet, as used with tonewheel organs: a horn for the highs and a drum for the lows, each " +
    "spinning at its own speed and speeding up or slowing down at its own rate.",
  notes: [
    "Assign Speed to a controller (the EFX control settings, or a foot switch) to switch between SLOW and FAST " +
      "while playing; the ramp between them is much of the sound.",
    "A real horn speeds up faster than the heavier drum: keep High Acceleration higher than Low Acceleration.",
    "The horn's fast speed is usually a little quicker than the drum's, so the two drift against each other.",
  ],
  params: {
    Speed: "SLOW or FAST: which pair of rates the horn and drum spin at.",
    "High Slow Rate": "The horn's speed at SLOW.",
    "High Fast Rate": "The horn's speed at FAST.",
    "Low Slow Rate": "The drum's speed at SLOW.",
    "Low Fast Rate": "The drum's speed at FAST.",
    "High Acceleration": "How quickly the horn changes speed between SLOW and FAST. Lower values take longer.",
    "Low Acceleration": "How quickly the drum changes speed between SLOW and FAST. Lower values take longer.",
    "High Level": "The horn's level.",
    "Low Level": "The drum's level.",
    Separation: "How wide the stereo image is, as if the microphones were set further apart.",
  },
  flow: rotaryFlow(),
};

export const COMPRESSOR: EfxHelp = {
  summary:
    "Evens out the level: loud parts are turned down and quiet parts brought up, so notes sustain longer and sit more " +
    "steadily. The channels are summed to mono, so Pan places the result.",
  notes: [
    "Long Sustain on clav, guitar or plucked sounds makes each note hold for longer, like a guitar compressor pedal.",
    "A slower Attack lets the start of each note through before the compression clamps down, keeping it punchy.",
  ],
  params: {
    Attack: "How quickly the compression takes hold after a note starts. Slower keeps more of the attack.",
    Sustain: "How strongly quiet parts are lifted: higher values hold notes at a steadier level for longer.",
  },
  flow: monoChain([{ id: "comp", label: "Compressor", params: ["Attack", "Sustain", "Post Gain"] }, { id: "eq", label: "EQ", params: EQ }]),
};

export const LIMITER: EfxHelp = {
  summary:
    "Stops the level going above a threshold, for a steady output without clipping. The channels are summed to mono, " +
    "so Pan places the result.",
  notes: [
    "A low Threshold with a high Ratio and Post Gain gives the squashed, pumping sound of a heavily limited drum loop.",
    "A short Release recovers quickly and can pump; a longer one sounds smoother.",
  ],
  params: {
    Threshold: "The level above which the limiter starts turning the sound down.",
    Ratio: "How hard the limiter turns it down: at 100:1 nothing gets past the threshold.",
    Release: "How quickly the limiter lets go once the level falls back below the threshold.",
  },
  flow: monoChain([{ id: "lim", label: "Limiter", params: ["Threshold", "Ratio", "Release", "Post Gain"] }, { id: "eq", label: "EQ", params: EQ }]),
};
