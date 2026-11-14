// The v1 parameter table: Patch Common and Patch Tone parameters the editor shows (★ in docs/jv2080-sysex-map.md).
// One row per parameter: block, offset, raw range and how the panel displays it. Tone rows apply to each of the
// four tones. The EFX parameters' meaning depends on the EFX type; see efx.ts.

import { fmtBendDown, fmtOffset, fmtPan, fmtSigned, fmtWaveNumber, HF_DAMP } from "./display";
import { EFX_TYPES } from "./efx";

export type ParamBlock = "common" | "tone";

export interface ParamDef {
  id: string;
  name: string;
  block: ParamBlock;
  offset: number;
  nibbled?: boolean; // a two-byte (#) value split into nibbles, high first, at offset and offset + 1
  min: number;
  max: number;
  display: (raw: number) => string;
  labels?: readonly string[]; // raw min…max for enums
  center?: number; // raw value shown as 0, for bipolar parameters
}

// --- Row builders ---

// Where a parameter lives and what it's called.
interface Where {
  block: ParamBlock;
  id: string;
  name: string;
  offset: number;
}

const common = (id: string, name: string, offset: number): Where => ({ block: "common", id, name, offset });
const tone = (id: string, name: string, offset: number): Where => ({ block: "tone", id, name, offset });

type Extra = Partial<Pick<ParamDef, "nibbled" | "center" | "display">>;

function range(where: Where, min: number, max: number, extra: Extra = {}): ParamDef {
  const display = extra.display ?? (extra.center === undefined ? String : fmtOffset(extra.center));
  return { ...where, min, max, ...extra, display };
}

function choice(where: Where, labels: readonly string[]): ParamDef {
  return { ...where, min: 0, max: labels.length - 1, labels, display: (raw) => labels[raw] ?? String(raw) };
}

const level = (where: Where) => range(where, 0, 127);
const depth = (where: Where) => range(where, 0, 126, { center: 63 }); // raw 0–126 shown as −63…+63
const onOff = (where: Where) => choice(where, ["OFF", "ON"]);

// Consecutive envelope times or levels: ids and names numbered from 1, eg. "Pitch Env T1"…"T4".
function envRows(first: Where, count: number, make: (where: Where) => ParamDef): ParamDef[] {
  return Array.from({ length: count }, (_, i) =>
    make({ ...first, id: `${first.id}${i + 1}`, name: `${first.name}${i + 1}`, offset: first.offset + i }));
}

// --- Patch Common ---

export const COMMON_PARAMS: readonly ParamDef[] = [
  choice(common("efxType", "EFX Type", 0x0c), EFX_TYPES.map((t, i) => `${i + 1}: ${t.name}`)),
  choice(common("efxOutput", "EFX Output", 0x19), ["MIX", "DIR1", "DIR2"]),
  level(common("efxMixSend", "EFX Mix Send", 0x1a)),
  level(common("efxChorusSend", "EFX Chorus Send", 0x1b)),
  level(common("efxReverbSend", "EFX Reverb Send", 0x1c)),
  level(common("chorusLevel", "Chorus Level", 0x21)),
  level(common("chorusRate", "Chorus Rate", 0x22)),
  level(common("chorusDepth", "Chorus Depth", 0x23)),
  level(common("chorusPreDelay", "Chorus Pre-Delay", 0x24)),
  level(common("chorusFeedback", "Chorus Feedback", 0x25)),
  choice(common("chorusOutput", "Chorus Output", 0x26), ["MIX", "REV", "MIX+REV"]),
  choice(common("reverbType", "Reverb Type", 0x27), ["ROOM1", "ROOM2", "STAGE1", "STAGE2", "HALL1", "HALL2", "DELAY", "PAN-DLY"]),
  level(common("reverbLevel", "Reverb Level", 0x28)),
  level(common("reverbTime", "Reverb Time", 0x29)),
  choice(common("reverbHfDamp", "Reverb HF Damp", 0x2a), [...HF_DAMP, "BYPASS"]),
  level(common("delayFeedback", "Delay Feedback", 0x2b)),
  range(common("tempo", "Tempo", 0x2c), 20, 250, { nibbled: true }),
  level(common("patchLevel", "Patch Level", 0x2e)),
  range(common("patchPan", "Patch Pan", 0x2f), 0, 127, { display: fmtPan }),
  range(common("bendUp", "Bend Up", 0x31), 0, 12, { display: fmtSigned }),
  range(common("bendDown", "Bend Down", 0x32), 0, 48, { display: fmtBendDown }),
  choice(common("keyAssign", "Key Assign", 0x33), ["POLY", "SOLO"]),
  onOff(common("soloLegato", "Legato", 0x34)),
  onOff(common("portamento", "Portamento", 0x35)),
  level(common("portamentoTime", "Porta Time", 0x39)),
  range(common("octaveShift", "Octave", 0x41), 0, 6, { center: 3 }),
  choice(common("clockSource", "Clock", 0x48), ["PATCH", "SYSTEM"]),
];

// --- Patch Tone ---

const LFO_WAVES = ["TRI", "SIN", "SAW", "SQR", "TRP", "S&H", "RND", "CHS"];

export const TONE_PARAMS: readonly ParamDef[] = [
  onOff(tone("toneSwitch", "Tone", 0x00)),
  range(tone("waveGroupType", "Wave Group Type", 0x01), 0, 2),
  range(tone("waveGroupId", "Wave Group ID", 0x02), 0, 127),
  range(tone("waveNumber", "Wave", 0x03), 0, 254, { nibbled: true, display: fmtWaveNumber }),
  choice(tone("lfo1Wave", "LFO1 Wave", 0x2d), LFO_WAVES),
  level(tone("lfo1Rate", "LFO1 Rate", 0x2f)),
  choice(tone("lfo2Wave", "LFO2 Wave", 0x35), LFO_WAVES),
  level(tone("lfo2Rate", "LFO2 Rate", 0x37)),
  range(tone("coarseTune", "Coarse", 0x3d), 0, 96, { center: 48 }),
  range(tone("fineTune", "Fine", 0x3e), 0, 100, { center: 50 }),
  range(tone("pitchEnvDepth", "Pitch Env Depth", 0x41), 0, 24, { center: 12 }),
  ...envRows(tone("pitchEnvTime", "Pitch Env T", 0x46), 4, level),
  ...envRows(tone("pitchEnvLevel", "Pitch Env L", 0x4a), 4, depth),
  depth(tone("pitchLfo1", "Pitch LFO1", 0x4e)),
  depth(tone("pitchLfo2", "Pitch LFO2", 0x4f)),
  choice(tone("filterType", "Filter Type", 0x50), ["OFF", "LPF", "BPF", "HPF", "PKG"]),
  level(tone("cutoff", "Cutoff", 0x51)),
  level(tone("resonance", "Resonance", 0x53)),
  depth(tone("filterEnvDepth", "Filter Env Depth", 0x55)),
  ...envRows(tone("filterEnvTime", "Filter Env T", 0x5b), 4, level),
  ...envRows(tone("filterEnvLevel", "Filter Env L", 0x5f), 4, level),
  depth(tone("filterLfo1", "Filter LFO1", 0x63)),
  depth(tone("filterLfo2", "Filter LFO2", 0x64)),
  level(tone("toneLevel", "Level", 0x65)),
  ...envRows(tone("ampEnvTime", "Amp Env T", 0x6e), 4, level),
  ...envRows(tone("ampEnvLevel", "Amp Env L", 0x72), 3, level), // Level 4 is fixed at 0
  depth(tone("ampLfo1", "Amp LFO1", 0x75)),
  depth(tone("ampLfo2", "Amp LFO2", 0x76)),
  range(tone("tonePan", "Pan", 0x77), 0, 127, { display: fmtPan }),
  choice(tone("outputAssign", "Output", 0x7d), ["MIX", "EFX", "DIR1", "DIR2"]),
  level(tone("mixEfxSend", "Mix/EFX Send", 0x7e)),
  level(tone("chorusSend", "Chorus Send", 0x7f)),
  level(tone("reverbSend", "Reverb Send", 0x80)), // offset 128: address 01 00 within the tone
];

export const ALL_PARAMS: readonly ParamDef[] = [...COMMON_PARAMS, ...TONE_PARAMS];
