// What each EFX type's view draws. A spec lists drawings (panels), each naming the type's parameters it drags (by
// their names in core/efxTable.ts); every parameter no panel names gets a knob or buttons below. A panel may also
// read other parameters to draw (eg. a pitch voice's Fine), which then stay knobs. Two-effect
// types show their halves joined by an arrow (series) or stacked (parallel).

export interface EqBand {
  label: string;
  shape: "low" | "high" | "peak";
  gain: string;
  freq?: string; // a list parameter of frequencies
  hz?: number; // or a fixed frequency
  q?: string;
}

export interface Tap {
  label: string;
  time: string;
  level?: string;
}

export interface Voice {
  label: string;
  coarse: string; // its Fine is drawn too, but stays a knob
}

export type PanelSpec =
  | { kind: "eq"; title: string; bands: readonly EqBand[] }
  | { kind: "spectrum"; title: string; bands: readonly string[]; q: string }
  | { kind: "drive"; title: string; drive: string; hard?: boolean }
  | { kind: "enhancer"; title: string; sens: string; mix: string }
  | { kind: "compressor"; title: string; sustain: string; attack: string }
  | { kind: "limiter"; title: string; threshold: string; ratio: string }
  | { kind: "lfo"; title: string; rate: string; depth: string; manual?: string; phase?: string; feedback?: string;
      step?: string }
  | { kind: "rotary"; title: string; speed: string; slow: readonly [hi: string, lo: string];
      fast: readonly [hi: string, lo: string] }
  | { kind: "delay"; title: string; taps: readonly Tap[]; feedback?: string; accel?: string }
  | { kind: "pitch"; title: string; voices: readonly Voice[]; feedback?: string }
  | { kind: "reverb"; title: string; time: string; preDelay: string }
  | { kind: "gate"; title: string; gateTime: string; preDelay: string }; // its Type is drawn, but stays buttons

export interface EfxSpec {
  panels: readonly PanelSpec[];
  join?: "series" | "parallel";
}

// Shelves on the types with Low Gain / High Gain (fixed corners; the manual gives none, these are typical).
const LOW_HZ = 200;
const HIGH_HZ = 4000;
const shelves = (low = "Low Gain", high = "High Gain"): EqBand[] => [
  { label: "LOW", shape: "low", gain: low, hz: LOW_HZ },
  { label: "HIGH", shape: "high", gain: high, hz: HIGH_HZ },
];

// Panels shared by the two-effect types, by the prefixes their parameters use.
const odDrive = (prefix: "OD" | "DIST"): PanelSpec =>
  ({ kind: "drive", title: prefix === "OD" ? "OVERDRIVE" : "DISTORTION", drive: `${prefix} Drive`, hard: prefix === "DIST" });
const enhancer: PanelSpec = { kind: "enhancer", title: "ENHANCER", sens: "Enhancer Sens", mix: "Enhancer Mix" };
const chorusLfo: PanelSpec = { kind: "lfo", title: "CHORUS", rate: "Chorus Rate", depth: "Chorus Depth" };
const flangerLfo: PanelSpec = { kind: "lfo", title: "FLANGER", rate: "FLNG Rate", depth: "FLNG Depth", feedback: "FLNG Feedback" };
const echo: PanelSpec = { kind: "delay", title: "DELAY", taps: [{ label: "", time: "Delay Time" }], feedback: "Delay Feedback" };
const series = (...panels: PanelSpec[]): EfxSpec => ({ panels, join: "series" });
const parallel = (...panels: PanelSpec[]): EfxSpec => ({ panels, join: "parallel" });

// By raw EFX Type (0–39).
export const EFX_SPECS: readonly EfxSpec[] = [
  /* 1 STEREO-EQ */ { panels: [{ kind: "eq", title: "STEREO EQ", bands: [
    { label: "LOW", shape: "low", gain: "Low Gain", freq: "Low Freq" },
    { label: "P1", shape: "peak", gain: "P1 Gain", freq: "P1 Freq", q: "P1 Q" },
    { label: "P2", shape: "peak", gain: "P2 Gain", freq: "P2 Freq", q: "P2 Q" },
    { label: "HIGH", shape: "high", gain: "High Gain", freq: "High Freq" }] }] },
  /* 2 OVERDRIVE */ { panels: [{ kind: "drive", title: "OVERDRIVE", drive: "Drive" }, { kind: "eq", title: "TONE", bands: shelves() }] },
  /* 3 DISTORTION */ { panels: [{ kind: "drive", title: "DISTORTION", drive: "Drive", hard: true }, { kind: "eq", title: "TONE", bands: shelves() }] },
  /* 4 PHASER */ { panels: [{ kind: "lfo", title: "PHASER", rate: "Rate", depth: "Depth", manual: "Manual" }] },
  /* 5 SPECTRUM */ { panels: [{ kind: "spectrum", title: "SPECTRUM", q: "Q",
    bands: ["Band1", "Band2", "Band3", "Band4", "Band5", "Band6", "Band7", "Band8"] }] },
  /* 6 ENHANCER */ { panels: [{ kind: "enhancer", title: "ENHANCER", sens: "Sens", mix: "Mix" }, { kind: "eq", title: "TONE", bands: shelves() }] },
  /* 7 AUTO-WAH */ { panels: [{ kind: "lfo", title: "AUTO WAH", rate: "Rate", depth: "Depth", manual: "Manual" }] },
  /* 8 ROTARY */ { panels: [{ kind: "rotary", title: "ROTARY", speed: "Speed", slow: ["High Slow Rate", "Low Slow Rate"],
    fast: ["High Fast Rate", "Low Fast Rate"] }] },
  /* 9 COMPRESSOR */ { panels: [{ kind: "compressor", title: "COMPRESSOR", sustain: "Sustain", attack: "Attack" }, { kind: "eq", title: "TONE", bands: shelves() }] },
  /* 10 LIMITER */ { panels: [{ kind: "limiter", title: "LIMITER", threshold: "Threshold", ratio: "Ratio" }, { kind: "eq", title: "TONE", bands: shelves() }] },
  /* 11 HEXA-CHORUS */ { panels: [{ kind: "lfo", title: "HEXA CHORUS", rate: "Rate", depth: "Depth" }] },
  /* 12 TREMOLO-CHORUS */ { panels: [{ kind: "lfo", title: "CHORUS", rate: "Chorus Rate", depth: "Chorus Depth" },
    { kind: "lfo", title: "TREMOLO", rate: "Tremolo Rate", depth: "Tremolo Separation", phase: "Tremolo Phase" }] },
  /* 13 SPACE-D */ { panels: [{ kind: "lfo", title: "SPACE-D", rate: "Rate", depth: "Depth", phase: "Phase" }, { kind: "eq", title: "TONE", bands: shelves() }] },
  /* 14 STEREO-CHORUS */ { panels: [{ kind: "lfo", title: "STEREO CHORUS", rate: "Rate", depth: "Depth", phase: "Phase" }, { kind: "eq", title: "TONE", bands: shelves() }] },
  /* 15 STEREO-FLANGER */ { panels: [{ kind: "lfo", title: "STEREO FLANGER", rate: "Rate", depth: "Depth", phase: "Phase", feedback: "Feedback" }, { kind: "eq", title: "TONE", bands: shelves() }] },
  /* 16 STEP-FLANGER */ { panels: [{ kind: "lfo", title: "STEP FLANGER", rate: "Rate", depth: "Depth", phase: "Phase", feedback: "Feedback", step: "Step Rate" }, { kind: "eq", title: "TONE", bands: shelves() }] },
  /* 17 STEREO-DELAY */ { panels: [{ kind: "delay", title: "STEREO DELAY", feedback: "Feedback",
    taps: [{ label: "L", time: "Delay Left" }, { label: "R", time: "Delay Right" }] }] },
  /* 18 MODULATION-DELAY */ { panels: [{ kind: "delay", title: "DELAY", feedback: "Feedback",
    taps: [{ label: "L", time: "Delay Left" }, { label: "R", time: "Delay Right" }] },
    { kind: "lfo", title: "MODULATION", rate: "Rate", depth: "Depth", phase: "Phase" }] },
  /* 19 TRIPLE-TAP-DELAY */ { panels: [{ kind: "delay", title: "TRIPLE TAP", feedback: "Feedback", taps: [
    { label: "L", time: "Delay Left", level: "Left Level" }, { label: "C", time: "Delay Center", level: "Center Level" },
    { label: "R", time: "Delay Right", level: "Right Level" }] }] },
  /* 20 QUADRUPLE-TAP-DELAY */ { panels: [{ kind: "delay", title: "QUAD TAP", feedback: "Feedback", taps: [
    { label: "1", time: "Delay 1", level: "Level 1" }, { label: "2", time: "Delay 2", level: "Level 2" },
    { label: "3", time: "Delay 3", level: "Level 3" }, { label: "4", time: "Delay 4", level: "Level 4" }] }] },
  /* 21 TIME-CONTROL-DELAY */ { panels: [{ kind: "delay", title: "TIME CONTROL DELAY", feedback: "Feedback", accel: "Acceleration",
    taps: [{ label: "", time: "Delay" }] }] },
  /* 22 2VOICE-PITCH-SHIFTER */ { panels: [{ kind: "pitch", title: "2-VOICE PITCH SHIFTER", voices: [
    { label: "A", coarse: "Coarse A" }, { label: "B", coarse: "Coarse B" }] }] },
  /* 23 FBK-PITCH-SHIFTER */ { panels: [{ kind: "pitch", title: "FEEDBACK PITCH SHIFTER", feedback: "Feedback",
    voices: [{ label: "", coarse: "Coarse" }] }] },
  /* 24 REVERB */ { panels: [{ kind: "reverb", title: "REVERB", time: "Time", preDelay: "Pre Delay" }, { kind: "eq", title: "TONE", bands: shelves() }] },
  /* 25 GATE-REVERB */ { panels: [{ kind: "gate", title: "GATE REVERB", gateTime: "Gate Time", preDelay: "Pre Delay" }] },
  /* 26 OD→CHORUS */ series(odDrive("OD"), chorusLfo),
  /* 27 OD→FLANGER */ series(odDrive("OD"), flangerLfo),
  /* 28 OD→DELAY */ series(odDrive("OD"), echo),
  /* 29 DIST→CHORUS */ series(odDrive("DIST"), chorusLfo),
  /* 30 DIST→FLANGER */ series(odDrive("DIST"), flangerLfo),
  /* 31 DIST→DELAY */ series(odDrive("DIST"), echo),
  /* 32 ENH→CHORUS */ series(enhancer, chorusLfo),
  /* 33 ENH→FLANGER */ series(enhancer, flangerLfo),
  /* 34 ENH→DELAY */ series(enhancer, echo),
  /* 35 CHORUS→DELAY */ series(chorusLfo, echo),
  /* 36 FLANGER→DELAY */ series(flangerLfo, echo),
  /* 37 CHORUS→FLANGER */ series(chorusLfo, flangerLfo),
  /* 38 CHORUS/DELAY */ parallel(chorusLfo, echo),
  /* 39 FLANGER/DELAY */ parallel(flangerLfo, echo),
  /* 40 CHORUS/FLANGER */ parallel(chorusLfo, flangerLfo),
];

// The parameter names a panel draws (and so takes off the knob rows).
const NOT_PARAMS = new Set(["kind", "title", "label", "shape"]);

export function panelParams(panel: PanelSpec): string[] {
  const names: string[] = [];
  const add = (v: unknown) => {
    if (typeof v === "string") names.push(v);
    else if (Array.isArray(v)) v.forEach(add);
    else if (v && typeof v === "object") addFields(v);
  };
  const addFields = (o: object) => Object.entries(o).forEach(([k, v]) => !NOT_PARAMS.has(k) && add(v));
  addFields(panel);
  return names;
}
