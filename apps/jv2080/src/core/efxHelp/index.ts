// Help for the EFX types, shown by the (i) on the EFX section: what each type does, tips, a line for each parameter
// and its signal flow. The words are ours; the flows are redrawn from the facts of the JV-2080 manual's diagrams.

import * as chains from "./chains";
import { commonDescription } from "./common";
import * as mod from "./modulation";
import * as time from "./time";
import * as tone from "./tone";
import type { EfxHelp } from "./types";

export type { EfxHelp } from "./types";
export * from "./flow";

// In EFX type order (raw 0–39).
export const EFX_HELP: readonly EfxHelp[] = [
  tone.STEREO_EQ, tone.OVERDRIVE, tone.DISTORTION, tone.PHASER, tone.SPECTRUM, tone.ENHANCER, tone.AUTO_WAH, tone.ROTARY,
  tone.COMPRESSOR, tone.LIMITER,
  mod.HEXA_CHORUS, mod.TREMOLO_CHORUS, mod.SPACE_D, mod.STEREO_CHORUS, mod.STEREO_FLANGER, mod.STEP_FLANGER,
  time.STEREO_DELAY, time.MODULATION_DELAY, time.TRIPLE_TAP_DELAY, time.QUADRUPLE_TAP_DELAY, time.TIME_CONTROL_DELAY,
  time.TWO_VOICE_PITCH_SHIFTER, time.FBK_PITCH_SHIFTER, time.REVERB, time.GATE_REVERB,
  chains.OVERDRIVE_CHORUS, chains.OVERDRIVE_FLANGER, chains.OVERDRIVE_DELAY, chains.DISTORTION_CHORUS,
  chains.DISTORTION_FLANGER, chains.DISTORTION_DELAY, chains.ENHANCER_CHORUS, chains.ENHANCER_FLANGER,
  chains.ENHANCER_DELAY, chains.CHORUS_DELAY, chains.FLANGER_DELAY, chains.CHORUS_FLANGER, chains.CHORUS_SLASH_DELAY,
  chains.FLANGER_SLASH_DELAY, chains.CHORUS_SLASH_FLANGER,
];

export const efxHelp = (type: number): EfxHelp | undefined => EFX_HELP[type];

// A parameter's description: the type's own, else the shared one.
export function paramHelp(type: number, name: string): string | undefined {
  return EFX_HELP[type]?.params?.[name] ?? commonDescription(name);
}

// Said of every type: which tones it hears.
export const EFX_GENERAL_NOTE =
  "Only tones whose output is set to EFX go through it (the Output buttons on each mixer strip). The EFX's own " +
  "output then goes to the mix, or a direct output, and can feed the chorus and reverb by its sends.";
