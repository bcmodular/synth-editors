// The keyboard (docs/sp404-design.md › Controllers › Keyboard), from the TouchOSC layout's keyboard_manager.lua:
// what a key or a pad does for the effect on the bus the keyboard is attached to.
// - Resonator: a key sets ROOT (its MIDI note); pads 1–16 set CHORD.
// - Hyper-Reso: a white key sets NOTE, as a scale degree (middle C = 1, the white keys up and down from it, no 0);
//   the pads set SCALE: Maj and Min, and a root on each of the other pads.
// - Vocoder (INPUT FX only): keys play it on MIDI channel 11; pads 1–10 set CHORD and the scale pads set SCALE.
// - Chromatic and Sound Gen: keys play the SP-404 on channel 16 (CHROMATIC within C2–C4; SOUND GEN the full range).
// Pure; useKeyboard.ts turns the results into parameter edits and MIDI.

import type { Bus, FxId } from "../core/fxTypes";

export const RESONATOR = 2;
export const HYPER_RESO = 31;
export const VOCODER = 44;

export type KeysFx = "resonator" | "hyperReso" | "vocoder";

export function keysFx(fxId: FxId, bus: Bus): KeysFx | undefined {
  if (fxId === RESONATOR) return "resonator";
  if (fxId === HYPER_RESO) return "hyperReso";
  if (fxId === VOCODER && bus === 5) return "vocoder";
  return undefined;
}

// What the keyboard is attached to.
export type KeysTarget = { kind: "bus"; bus: Bus } | { kind: "chromatic" } | { kind: "soundGen" };

export const CHROMATIC_CHANNEL = 15; // 0-based: channel 16
export const VOCODER_CHANNEL = 10; // channel 11
const CHROMATIC_LOW = 36; // C2
const CHROMATIC_HIGH = 60; // C4

// Parameter indices (core/effects.ts).
export const PARAM = { root: 0, note: 0, resoChord: 3, scale: 3, vocoderChord: 4 } as const;

// ---- Hyper-Reso degrees on the white keys

const WHITE = new Set([0, 2, 4, 5, 7, 9, 11]);
export const isWhite = (note: number) => WHITE.has(((note % 12) + 12) % 12);

const DEGREE_MIN = -17;
const DEGREE_MAX = 18;
const ANCHOR = 60; // middle C = degree 1

const whitesBetween = (a: number, b: number) => {
  let n = 0;
  for (let k = Math.min(a, b); k < Math.max(a, b); k++) if (isWhite(k)) n++;
  return n;
};

// The scale degree a white key plays, clamped to the effect's range; undefined for a black key.
export function degreeOf(note: number): number | undefined {
  if (!isWhite(note)) return undefined;
  const degree = note >= ANCHOR ? whitesBetween(ANCHOR, note) + 1 : -whitesBetween(note, ANCHOR);
  return Math.max(DEGREE_MIN, Math.min(DEGREE_MAX, degree));
}

// The NOTE step for a degree (its 35 steps run −17 … −1, 1 … 18).
export const degreeStep = (degree: number): number => (degree < 0 ? degree + 17 : degree + 16);

// ---- scales: 24 steps, C–B major then C–B minor

export interface Scale {
  root: number; // pitch class 0–11
  minor: boolean;
}

export const scaleStep = ({ root, minor }: Scale): number => root + (minor ? 12 : 0);
export const scaleOf = (step: number): Scale => ({ root: step % 12, minor: step >= 12 });

// ---- pads (16, top row 1–8, bottom row 9–16)

export type ScalePad = "major" | "minor" | number | undefined; // a number is a root

// As the TouchOSC layout's Hyper-Reso pads: the black keys on the top row, the white keys on the bottom.
const SCALE_PADS: readonly ScalePad[] = [
  "major", undefined, 1, 3, undefined, 6, 8, 10,
  "minor", 0, 2, 4, 5, 7, 9, 11,
];

export const scalePad = (pad: number): ScalePad => SCALE_PADS[pad];

const NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
export const scalePadLabel = (p: ScalePad): string =>
  p === "major" ? "MAJ" : p === "minor" ? "MIN" : p === undefined ? "" : NAMES[p]!;

export function pressScalePad(was: Scale, pad: number): Scale | undefined {
  const p = scalePad(pad);
  if (p === undefined) return undefined;
  if (p === "major" || p === "minor") return { root: was.root, minor: p === "minor" };
  return { root: p, minor: was.minor };
}

export const RESONATOR_CHORDS = 16;
export const VOCODER_CHORDS = 10;

// ---- what a key does

// Set a step of a discrete parameter, or a raw value.
export type ParamAction = { kind: "param"; index: number; step?: number; raw?: number };
export type KeyAction = ParamAction | { kind: "play"; channel: number; note: number };

export function keyAction(target: KeysTarget | undefined, fx: KeysFx | undefined, note: number): KeyAction | undefined {
  if (!target) return undefined;
  if (target.kind === "chromatic") {
    return { kind: "play", channel: CHROMATIC_CHANNEL, note: Math.max(CHROMATIC_LOW, Math.min(CHROMATIC_HIGH, note)) };
  }
  if (target.kind === "soundGen") return { kind: "play", channel: CHROMATIC_CHANNEL, note };
  if (fx === "vocoder") return { kind: "play", channel: VOCODER_CHANNEL, note };
  if (fx === "resonator") return { kind: "param", index: PARAM.root, raw: note };
  const degree = fx === "hyperReso" ? degreeOf(note) : undefined;
  return degree === undefined ? undefined : { kind: "param", index: PARAM.note, step: degreeStep(degree) };
}

// What a pad does: a chord (Resonator, Vocoder), else a scale pad (Hyper-Reso; the Vocoder's scale is on screen).
export function padAction(fx: KeysFx | undefined, pad: number, scale: Scale): ParamAction | undefined {
  if (fx === "resonator" && pad < RESONATOR_CHORDS) return { kind: "param", index: PARAM.resoChord, step: pad };
  if (fx === "vocoder" && pad < VOCODER_CHORDS) return { kind: "param", index: PARAM.vocoderChord, step: pad };
  const next = fx === "hyperReso" ? pressScalePad(scale, pad) : undefined;
  return next && { kind: "param", index: PARAM.scale, step: scaleStep(next) };
}
