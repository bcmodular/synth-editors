// A plausible patch for working on the editor without a JV (open the app with ?demo): one tone on, a piano wave, the
// EFX parameters at their middle values. For screens only; it isn't meant to be sent to a JV.

import { EFX_TYPES, efxParamOffset, efxStartValue } from "../core/efx";
import { PATCH_BLOCKS, setParam, setPatchName, type Patch } from "../core/patch";
import { ALL_PARAMS } from "../core/params";
import { clampParam } from "../core/paramValue";

// Values that differ from the parameter's centre (bipolar) or minimum.
const DEFAULTS: Record<string, number> = {
  patchLevel: 100, patchPan: 64, bendUp: 2, bendDown: 2, octaveShift: 3, tempo: 120,
  efxMixSend: 127, chorusLevel: 40, chorusRate: 20, chorusDepth: 40, reverbType: 4, reverbLevel: 50, reverbTime: 64,
  reverbHfDamp: 17,
  toneSwitch: 1, waveGroupId: 1, lfo1Rate: 64, lfo2Rate: 40, filterType: 1, cutoff: 100, resonance: 10,
  filterEnvTime2: 40, filterEnvTime3: 60, filterEnvTime4: 30, filterEnvLevel1: 127, filterEnvLevel2: 90, filterEnvLevel3: 70,
  toneLevel: 110, ampEnvTime2: 50, ampEnvTime4: 30, ampEnvLevel1: 127, ampEnvLevel2: 100, ampEnvLevel3: 90,
  mixEfxSend: 127, chorusSend: 40, reverbSend: 50,
  pitchKeyfollow: 12, // +100 %: an octave per octave
  velocityUpper: 127, keyUpper: 127, rxVolume: 1, rxBend: 1, rxHold1: 1, rxPan: 1, ampEnvVelSens: 70, filterEnvVelSens: 60,
};

// A table parameter's neutral entry ("0", "0 dB"), if it has one.
const neutral = (labels: readonly string[] | undefined) => {
  const i = labels?.findIndex((l) => l === "0" || l === "0 dB") ?? -1;
  return i < 0 ? undefined : i;
};

function withEfxMiddles(patch: Patch): Patch {
  const common = [...patch[0]!];
  for (const p of EFX_TYPES[0]!.params) common[efxParamOffset(p.slot)] = efxStartValue(p);
  return [common, ...patch.slice(1)];
}

export function demoPatch(): Patch {
  let patch: Patch = PATCH_BLOCKS.map((b) => new Array<number>(b.size).fill(0));
  for (const p of ALL_PARAMS) {
    const value = DEFAULTS[p.id] ?? p.center ?? neutral(p.labels) ?? p.min;
    const tones = p.block === "tone" ? [0, 1, 2, 3] : [0];
    for (const tone of tones) patch = setParam(patch, p, clampParam(p, value), tone);
  }
  // Only tone 1 sounds; the others are switched off.
  for (const tone of [1, 2, 3]) patch = setParam(patch, ALL_PARAMS.find((p) => p.id === "toneSwitch")!, 0, tone);
  return setPatchName(withEfxMiddles(patch), "DEMO PATCH");
}

export const isDemo = () => new URLSearchParams(location.search).has("demo");
