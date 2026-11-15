// Help for each EFX type, by type name, its slots by name (as in core/efx.ts). Facts and ranges from Dope Robot's
// Unofficial TB-3 Effects Parameter Guide and SysEx Implementation; the wording is ours.
import type { EfxTypeHelp } from "./types";

const LEVEL = "The effect's output level.";
const EFX_LVL = "The effected signal's level.";
const DIRECT = "The dry signal's level, mixed with the effect.";
const BALANCE = "The mix of dry (left) and effected (right) signal.";
const EQ_LOW = "Low shelf, ±15 dB.";
const EQ_HIGH = "High shelf, ±15 dB.";
const SYNC = "Locks the rate to the tempo as a note value; OFF uses RATE.";
const RATE = "How fast it moves, when BPM SYNC is OFF (the time for one cycle).";
const HPF = "Cuts the lows going into the effect.";
const LPF = "Cuts the highs going into the effect.";

export const EFX_TYPE_HELP: Readonly<Record<string, EfxTypeHelp>> = {
  BYPASS: { summary: "No effect: the sound passes straight through.", params: {} },
  COMP: {
    summary: "A compressor: evens out the level by turning down whatever goes over the threshold, then makes it up with GAIN.",
    params: {
      THRESHOLD: "The level above which it starts turning down (−40 to 0 dB).",
      RATIO: "How hard it turns down above the threshold: 1:1 is none, 1:INF a limiter.",
      ATTACK: "How quickly it reacts to a loud note (up to about 0.8 s).",
      RELEASE: "How quickly it lets go afterwards (up to about 8 s).",
      KNEE: "Hard turns down sharply at the threshold; Soft 1–9 eases in around it.",
      GAIN: "Make-up gain after compressing, ±40 dB.",
      BALANCE,
    },
    notes: ["On harmonically rich sounds it behaves more like an overdrive: set the threshold and times with care."],
  },
  "RING MOD": {
    summary: "A ring modulator: multiplies the sound with an internal tone for bell, metal and robot sounds.",
    params: {
      FREQ: "The internal tone's frequency.",
      SENS: "How much the input's level bends that frequency, in the direction UP / DOWN sets.",
      BALANCE,
      LEVEL,
      "EQ LOW": EQ_LOW,
      "EQ HIGH": EQ_HIGH,
    },
    modes: "UP or DOWN: which way the input bends the frequency. UP tends to be the more musical; DOWN buzzier.",
  },
  "BIT CRUSH": {
    summary: "Lo-fi: lowers the sample rate for a gritty, aliased digital sound, with a filter to tame it.",
    params: {
      FILTER: "A low-pass filter's cutoff, to soften the grit.",
      "SAMP RATE": "How far the sample rate is lowered: higher is crunchier.",
      LEVEL,
      "EQ LOW": EQ_LOW,
      "EQ HIGH": EQ_HIGH,
    },
  },
  TREMOLO: {
    summary: "Tremolo or auto-pan: an LFO moving the level up and down, or the sound left and right.",
    params: {
      "BPM SYNC": SYNC,
      RATE,
      DEPTH: "How far the level (or pan) moves.",
      TYPE: "The LFO's wave: triangle, saws up and down, sine, square or random.",
      LEVEL,
      PHASE: "How far the right channel's wave lags the left's (0–360°): stereo movement.",
      SHAPE: "Steepens the wave towards a square: choppier.",
    },
    modes: "TREMOLO moves the level; PAN moves the sound between left and right.",
  },
  CHORUS: {
    summary: "A chorus: short, moving delays mixed back in, for width and shimmer.",
    params: {
      "BPM SYNC": SYNC,
      RATE,
      DEPTH: "How far the delays move: more is more wobbly.",
      "PRE DLY": "How far behind the dry sound the chorus starts (up to 80 ms).",
      LEVEL,
      HPF,
      LPF,
    },
    modes: "MONO, STEREO1 or STEREO2. STEREO2 puts the dry sound on the left and the chorus on the right.",
  },
  FLANGER: {
    summary: "A flanger: a very short, sweeping delay fed back, for the jet-plane comb sweep.",
    params: {
      "BPM SYNC": SYNC,
      RATE,
      DEPTH: "How far the sweep goes.",
      MANUAL: "Where the sweep centres: the comb's position.",
      RESONANCE: "Feedback: a sharper, more metallic comb.",
      SEPARATION: "Spreads the effect across the stereo field.",
      HPF,
      "EFX LVL": EFX_LVL,
      "DIRECT LVL": DIRECT,
    },
  },
  PHASER: {
    summary: "A phaser: sweeping notches through the sound, smoother and more hollow than a flanger.",
    params: {
      "BPM SYNC": SYNC,
      RATE: "How fast it sweeps, when BPM SYNC and STEP RATE are OFF.",
      "STEP RATE": "Moves the sweep in steps at a note value instead of smoothly; good at low depth.",
      DEPTH: "How far the sweep goes.",
      MANUAL: "Where the sweep centres; higher brings out more low end.",
      RESONANCE: "Feedback: deeper, more pronounced notches.",
      "EFX LVL": EFX_LVL,
      "DIRECT LVL": DIRECT,
    },
    modes: "4, 8 or 12 stages (more notches, a stronger effect) or BI-PH (bi-phase).",
  },
  DELAY: {
    summary: "A delay: repeats of the sound, fading by FEEDBACK.",
    params: {
      "BPM SYNC": "Sets the delay time as a note value against the tempo; OFF uses TIME.",
      TIME: "The time between repeats, when BPM SYNC is OFF.",
      "TAP TIME": "In PAN mode, the left repeat's time as a share of the right's.",
      FEEDBACK: "How much of each repeat feeds back: more repeats.",
      LPF: "Darkens the repeats, like tape or analog delays.",
      "EFX LVL": EFX_LVL,
      "DIRECT LVL": DIRECT,
    },
    modes: "SINGLE (one delay), PAN (repeats bouncing left and right) or STEREO.",
    notes: ["A dotted-eighth or 3/16 delay with some feedback is a classic way to fill out a 16th-note acid line."],
  },
  "PITCH SHIFT": {
    summary: "Two pitch-shifted copies of the sound, each up to two octaves up or down, for intervals and chords (EFX1 only).",
    params: {
      "PITCH 1": "Voice 1's shift in semitones (±24).",
      "PRE DLY 1": "How far behind the dry sound voice 1 starts (up to 100 ms).",
      "EFX LVL 1": "Voice 1's level.",
      FEEDBACK: "Feeds the shifted sound back in, so it climbs or falls in steps.",
      "PITCH 2": "Voice 2's shift in semitones (±24).",
      "PRE DLY 2": "How far behind the dry sound voice 2 starts.",
      "EFX LVL 2": "Voice 2's level.",
      "DIRECT LVL": DIRECT,
    },
    modes: "1MONO (one voice), 2MONO (two) or 2STEREO (two, one each side).",
    notes: ["Fifths and octaves work best; with the oscillators detuned too, a single note can become a chord."],
  },
  EQ: {
    summary: "A six-band equaliser (EFX1 only): low and high cuts, low and high shelves, and two fully parametric mids.",
    params: {
      "LOW CUT": "A high-pass filter: cuts below the chosen frequency (Flat = off).",
      "LOW GAIN": "Low shelf, ±20 dB.",
      "HI CUT": "A low-pass filter: cuts above the chosen frequency (Flat = off).",
      "HI GAIN": "High shelf, ±20 dB.",
      "LM FREQ": "The low-mid band's centre frequency.",
      "LM Q": "The low-mid band's width: higher is narrower.",
      "LM GAIN": "The low-mid band's boost or cut, ±20 dB.",
      "HM FREQ": "The high-mid band's centre frequency.",
      "HM Q": "The high-mid band's width.",
      "HM GAIN": "The high-mid band's boost or cut, ±20 dB.",
      LEVEL: "The EQ's output level, ±20 dB.",
    },
    notes: ["Drag a band's handle sideways for its frequency, up and down for its gain; scroll on a mid band for its Q."],
  },
  REVERB: {
    summary: "A reverb (EFX2 only): the sound in a space, from a small room to a long hall, a plate or a spring.",
    params: {
      TIME: "How long the reverb takes to die away (up to 9.9 s). It doesn't follow the tempo.",
      "PRE DLY": "The gap before the reverb starts: more keeps the dry sound clear.",
      DENSITY: "How dense the early reflections are.",
      "SPRING SNS": "How hard the spring is driven (SPRING only).",
      HPF,
      LPF,
      "EFX LVL": EFX_LVL,
      "DIRECT LVL": DIRECT,
    },
    modes: "The space: AMBIENT, ROOM, HALL 1, HALL 2, PLATE, SPRING or MOD (a modulated, chorused reverb).",
    notes: ["AMBIENT with TIME and PRE DLY at zero makes a doubling effect rather than a room."],
  },
};

export const EFX_GENERAL_NOTES = [
  "PITCH SHIFT and EQ are EFX1 only; REVERB is EFX2 only.",
  "The front panel's EFFECT knob sets how much of each sound's effect you hear; here you set the effect itself.",
];
