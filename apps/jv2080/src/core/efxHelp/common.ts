// Descriptions shared by many EFX types, by parameter name. A type's own description wins; a prefixed name
// ("FLNG Feedback", "Delay HF Damp") falls back to the name without its prefix.

export const BALANCE_SCALE =
  "D100:0W is the dry signal alone, D0:100W the effect alone, and D50:50W an even blend.";

export const COMMON_PARAMS: Readonly<Record<string, string>> = {
  Level: "The EFX output level. Use it to match the level with the effect on and off.",
  Pan: "Where the effect's output sits in the stereo field, L64 to 63R.",
  "Low Gain": "Boost or cut of the bass on the way out (a low shelf in the output EQ).",
  "High Gain": "Boost or cut of the treble on the way out (a high shelf in the output EQ).",
  Balance: `The blend of the dry input and the effect. ${BALANCE_SCALE}`,
  Feedback:
    "How much of the output goes round again. More gives more repeats or a stronger, ringing sweep; negative " +
    "values feed it back inverted, which sounds hollower.",
  "HF Damp":
    "Cuts the highs above this frequency each time the sound goes round the feedback loop, so repeats grow darker, " +
    "like tape or analogue echo. BYPASS keeps them bright.",
  "Pre Delay": "How long after the dry sound the effect starts.",
  Rate: "How fast the modulation moves.",
  Depth: "How far the modulation moves.",
  Phase: "How far apart the left and right modulation run. More gives a wider stereo image.",
  Time: "The time from the dry sound to the echo.",
  Drive: "How hard the signal is driven. The level rises with it, so bring Level down to compensate.",
  Sens: "How strongly the enhancer reacts. Higher adds more high harmonics.",
  Mix: "How much of the effect is added to the dry signal.",
  "Post Gain": "Make-up gain after the dynamics, to bring the level back up.",
  "Pre Delay A": "How long after the dry sound voice A starts.",
  "Pre Delay B": "How long after the dry sound voice B starts.",
};

const PREFIXES = ["FLNG ", "Chorus ", "Delay ", "OD ", "DIST ", "Enhancer "];

const PREFIX_WORDS: Readonly<Record<string, string>> = {
  "FLNG ": "flanger",
  "Chorus ": "chorus",
  "Delay ": "delay",
  "OD ": "overdrive",
  "DIST ": "distortion",
  "Enhancer ": "enhancer",
};

// A chain's stage balance: the blend of what goes into that stage and what comes out of it.
function stageBalance(stage: string): string {
  return `The blend of the sound going into the ${stage} (D) and the ${stage}'s output (W). D100:0W skips the ${stage}; ` +
    `D0:100W is the ${stage} alone.`;
}

export function commonDescription(name: string): string | undefined {
  if (COMMON_PARAMS[name]) return COMMON_PARAMS[name];
  const prefix = PREFIXES.find((p) => name.startsWith(p));
  if (!prefix) return undefined;
  const rest = name.slice(prefix.length);
  if (rest === "Balance") return stageBalance(PREFIX_WORDS[prefix]!);
  if (rest === "Pan") return `Where the ${PREFIX_WORDS[prefix]} sits in the stereo field before the next stage, L64 to 63R.`;
  return COMMON_PARAMS[rest];
}
