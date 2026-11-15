// Help rows for each tone part's "⋯" settings (editor/ToneMore.tsx), shown in place in the copy beside the part's
// help. LFO1 and LFO2 share a row where their settings work the same way.

import type { SectionRow } from "./types";

// An envelope's velocity and key rows; `sens` leaves out Vel Sens where the part shows it as a knob (filter, amp).
function envelopeRows(prefix: string, what: string, opts: { curve: boolean; sens: boolean }): SectionRow[] {
  return [
    ...(opts.curve ? [{ label: "Vel Curve", ids: [`${prefix}VelCurve`], text: `Which of seven curves turns playing strength into the ${what} envelope's depth.` }] : []),
    ...(opts.sens ? [{ label: "Vel Sens", ids: [`${prefix}VelSens`], text: `How much harder playing deepens the ${what} envelope; negative values make soft notes deeper.` }] : []),
    { label: "Vel T1", ids: [`${prefix}VelTime1`], text: "Harder playing shortens the envelope's first time, its attack (or lengthens it, if negative)." },
    { label: "Vel T4", ids: [`${prefix}VelTime4`], text: "A faster key release shortens the envelope's release, time 4 (or lengthens it, if negative)." },
    { label: "Time KF", ids: [`${prefix}TimeKeyfollow`], text: "Higher keys shorten times 2–4 (or lengthen them, if negative), relative to C4." },
  ];
}

const both = (id: string) => [`lfo1${id}`, `lfo2${id}`];

export const PITCH_MORE: readonly SectionRow[] = [
  { label: "Random", ids: ["randomPitch"], text: "A random detune on each note, up to this many cents: a touch adds life, more sounds out of tune." },
  { label: "Keyfollow", ids: ["pitchKeyfollow"], text: "How far the pitch moves per octave played: +100 is normal, 0 plays the same pitch on every key, other values stretch or squeeze the keyboard." },
  ...envelopeRows("pitchEnv", "pitch", { curve: false, sens: true }),
];

export const FILTER_MORE: readonly SectionRow[] = [
  { label: "Keyfollow", ids: ["cutoffKeyfollow"], text: "Opens the filter further for higher notes (or closes it, if negative), from C4, as acoustic instruments brighten up the keyboard." },
  { label: "Reso Vel", ids: ["resonanceVelSens"], text: "Harder playing adds resonance (or takes it away, if negative)." },
  ...envelopeRows("filterEnv", "filter", { curve: true, sens: false }),
];

export const AMP_MORE: readonly SectionRow[] = [
  ...envelopeRows("ampEnv", "amp", { curve: true, sens: false }),
  {
    label: "Bias Direction", ids: ["biasDirection"],
    text: "Where the level changes with the key: LOWER below the Position key, UPPER above it, LOW&UP both ways, ALL across the keyboard on a slope.",
  },
  { label: "Bias Position", ids: ["biasPosition"], text: "The key the bias works from." },
  { label: "Bias Level", ids: ["biasLevel"], text: "How much the level changes away from the Position key; negative values turn it the other way." },
  { label: "Pan LFO1 / LFO2", ids: ["panLfo1", "panLfo2"], text: "How much each LFO moves the pan: an auto-pan." },
  { label: "Pan Keyfollow", ids: ["panKeyfollow"], text: "Pans higher notes further right (or left, if negative), from C4." },
  { label: "Random Pan", ids: ["randomPan"], text: "Puts each new note at a random place in the stereo field, further with higher values." },
  { label: "Alternate Pan", ids: ["alternatePan"], text: "Alternates notes between left and right by this much; L or R sets which side comes first." },
];

export const LFO_MORE: readonly SectionRow[] = [
  { label: "Key Trig", ids: both("KeyTrigger"), text: "ON restarts the LFO at every note, so each note's vibrato or tremolo starts the same way." },
  { label: "Offset", ids: both("Offset"), text: "Moves the LFO's swing up or down from the centre: +100 swings only above, −100 only below." },
  { label: "Delay", ids: both("Delay"), text: "How long after the note (or its release, for the OFF fade modes) the LFO starts." },
  {
    label: "Fade", ids: both("FadeMode"),
    text: "ON-IN fades the LFO in after the key goes down; ON-OUT fades it out; OFF-IN and OFF-OUT do the same from the key's release.",
  },
  { label: "Fade Time", ids: both("FadeTime"), text: "How long the fade takes." },
  { label: "Sync", ids: both("Sync"), text: "CLOCK locks the LFO's rate to the tempo, as a note value." },
];
