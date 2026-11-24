// Patch parameters beyond the first set (docs/jv2080-not-in-editor.md): velocity and keyfollow, ranges, structure,
// LFO and pan extras, wave extras, tone delay, MIDI receive switches and the rest of the patch settings. Offsets and
// ranges from the manual's address map (p. 189–190). The controller matrix and EFX control are in paramsControl.ts.

import { fmtNote, fmtPan, fmtPanDepth, fmtVelSens, KEYFOLLOW, RANDOM_PITCH, TIME_SENS } from "./display";
import { choice, common, level, onOff, range, tone, type ParamDef, type Where } from "./paramDefs";

const velSens = (where: Where) => range(where, 0, 125, { center: 50, display: fmtVelSens }); // −100…+150
const timeSens = (where: Where) => choice(where, TIME_SENS); // −100…+100, 0 at raw 7
const velCurve = (where: Where) => range(where, 0, 6, { display: (raw) => String(raw + 1) }); // 1–7
const note = (where: Where) => range(where, 0, 127, { display: fmtNote });

const BOOSTER = ["0 dB", "+6 dB", "+12 dB", "+18 dB"];
const STRUCTURES = Array.from({ length: 10 }, (_, i) => String(i + 1));

export const PATCH_CATEGORIES = [
  "NO ASSIGN", "AC.PIANO", "EL.PIANO", "KEYBOARDS", "BELL", "MALLET", "ORGAN", "ACCORDION", "HARMONICA", "AC.GUITAR",
  "EL.GUITAR", "DIST.GUITAR", "BASS", "SYNTH BASS", "STRINGS", "ORCHESTRA", "HIT&STAB", "WIND", "FLUTE", "AC.BRASS",
  "SYNTH BRASS", "SAX", "HARD LEAD", "SOFT LEAD", "TECHNO SYNTH", "PULSATING", "SYNTH FX", "OTHER SYNTH", "BRIGHT PAD",
  "SOFT PAD", "VOX", "PLUCKED", "ETHNIC", "FRETTED", "PERCUSSION", "SOUND FX", "BEAT&GROOVE", "DRUMS", "COMBINATION",
];

export const COMMON_MORE: readonly ParamDef[] = [
  level(common("analogFeel", "Analog Feel", 0x30)),
  choice(common("portamentoMode", "Porta Mode", 0x36), ["NORMAL", "LEGATO"]),
  choice(common("portamentoType", "Porta Type", 0x37), ["RATE", "TIME"]),
  choice(common("portamentoStart", "Porta Start", 0x38), ["PITCH", "NOTE"]),
  onOff(common("velocityRangeSwitch", "Velocity Ranges", 0x40)),
  choice(common("stretchTune", "Stretch Tune", 0x42), ["OFF", "1", "2", "3"]),
  choice(common("voicePriority", "Voice Priority", 0x43), ["LAST", "LOUDEST"]),
  choice(common("structure12", "Structure 1&2", 0x44), STRUCTURES),
  choice(common("booster12", "Booster 1&2", 0x45), BOOSTER),
  choice(common("structure34", "Structure 3&4", 0x46), STRUCTURES),
  choice(common("booster34", "Booster 3&4", 0x47), BOOSTER),
  // Raw 0–127, but only 0–38 are named (p. 190 *12).
  range(common("patchCategory", "Category", 0x49), 0, PATCH_CATEGORIES.length - 1, { display: (raw) => PATCH_CATEGORIES[raw] ?? String(raw) }),
];

// Each LFO's extras, at its base offset (LFO1 0x2d, LFO2 0x35): key trigger +1, offset +3, delay +4, fade +5/+6, sync +7.
function lfoMore(n: 1 | 2, base: number): ParamDef[] {
  const at = (id: string, name: string, offset: number) => tone(`lfo${n}${id}`, `LFO${n} ${name}`, base + offset);
  return [
    onOff(at("KeyTrigger", "Key Trigger", 1)),
    choice(at("Offset", "Offset", 3), ["-100", "-50", "0", "+50", "+100"]),
    level(at("Delay", "Delay", 4)),
    choice(at("FadeMode", "Fade Mode", 5), ["ON-IN", "ON-OUT", "OFF-IN", "OFF-OUT"]),
    level(at("FadeTime", "Fade Time", 6)),
    choice(at("Sync", "Ext Sync", 7), ["OFF", "CLOCK"]), // the manual's third value, <TAP>, isn't on the JV-2080
  ];
}

// An envelope's velocity and keyfollow controls (Pitch 0x42, Filter 0x56, Level 0x69).
function envMore(prefix: string, name: string, at: { curve?: number; sens: number }): ParamDef[] {
  const row = (id: string, label: string, offset: number) => tone(`${prefix}${id}`, `${name} ${label}`, offset);
  return [
    ...(at.curve === undefined ? [] : [velCurve(row("VelCurve", "Vel Curve", at.curve))]),
    velSens(row("VelSens", "Vel Sens", at.sens)),
    timeSens(row("VelTime1", "Vel Time 1", at.sens + 1)),
    timeSens(row("VelTime4", "Vel Time 4", at.sens + 2)),
    timeSens(row("TimeKeyfollow", "Time Keyfollow", at.sens + 3)),
  ];
}

export const TONE_MORE: readonly ParamDef[] = [
  choice(tone("waveGain", "Wave Gain", 0x05), ["-6 dB", "0 dB", "+6 dB", "+12 dB"]),
  onOff(tone("fxmSwitch", "FXM", 0x06)),
  range(tone("fxmColor", "FXM Color", 0x07), 0, 3, { display: (raw) => String(raw + 1) }),
  range(tone("fxmDepth", "FXM Depth", 0x08), 0, 15, { display: (raw) => String(raw + 1) }),
  choice(tone("toneDelayMode", "Tone Delay", 0x09),
    ["NORMAL", "HOLD", "PLAYMATE", "CLOCK-SYNC", "TAP-SYNC", "KEY-OFF-N", "KEY-OFF-D", "TEMPO-SYNC"]),
  level(tone("toneDelayTime", "Delay Time", 0x0a)),
  level(tone("velocityFade", "Vel Fade", 0x0b)),
  range(tone("velocityLower", "Vel Lower", 0x0c), 1, 127),
  range(tone("velocityUpper", "Vel Upper", 0x0d), 1, 127),
  note(tone("keyLower", "Key Lower", 0x0e)),
  note(tone("keyUpper", "Key Upper", 0x0f)),
  onOff(tone("rxRedamper", "Redamper", 0x10)),
  onOff(tone("rxVolume", "Volume", 0x11)),
  onOff(tone("rxHold1", "Hold-1", 0x12)),
  onOff(tone("rxBend", "Pitch Bend", 0x13)),
  choice(tone("rxPan", "Pan", 0x14), ["OFF", "CONTINUOUS", "KEY-ON"]),
  ...lfoMore(1, 0x2d),
  ...lfoMore(2, 0x35),
  choice(tone("randomPitch", "Random Pitch", 0x3f), RANDOM_PITCH),
  choice(tone("pitchKeyfollow", "Pitch Keyfollow", 0x40), KEYFOLLOW),
  ...envMore("pitchEnv", "Pitch Env", { sens: 0x42 }),
  choice(tone("cutoffKeyfollow", "Cutoff Keyfollow", 0x52), KEYFOLLOW),
  velSens(tone("resonanceVelSens", "Reso Vel Sens", 0x54)),
  ...envMore("filterEnv", "Filter Env", { curve: 0x56, sens: 0x57 }),
  choice(tone("biasDirection", "Bias Direction", 0x66), ["LOWER", "UPPER", "LOW&UP", "ALL"]),
  note(tone("biasPosition", "Bias Position", 0x67)),
  choice(tone("biasLevel", "Bias Level", 0x68), TIME_SENS),
  ...envMore("ampEnv", "Amp Env", { curve: 0x69, sens: 0x6a }),
  choice(tone("panKeyfollow", "Pan Keyfollow", 0x78), TIME_SENS),
  range(tone("randomPan", "Random Pan", 0x79), 0, 63),
  range(tone("alternatePan", "Alternate Pan", 0x7a), 1, 127, { center: 64, display: fmtPan }),
  range(tone("panLfo1", "Pan LFO1", 0x7b), 0, 126, { center: 63, display: fmtPanDepth }),
  range(tone("panLfo2", "Pan LFO2", 0x7c), 0, 126, { center: 63, display: fmtPanDepth }),
];
