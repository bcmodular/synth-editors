// Help for EFX types 17–25: delays, pitch shifters and reverbs.

import {
  at, dry, edge, fx, join, via, level, mixEnd, mixOut, monoIn, parts, stereoIn, sum, tap, wet, WIDE, withFeedback,
  type Flow, type FlowEdge, type Gain, type GainSide,
} from "./flow";
import type { EfxHelp } from "./types";

const LOOP = ["Feedback", "HF Damp"];
const pan = (param: string) => (side: GainSide): Gain[] => [{ param, side }];
const dryPaths = (): FlowEdge[] => [edge("inL", "mixL", { gains: [dry("Balance")] }), edge("inR", "mixR", { gains: [dry("Balance")] })];

// A delay on each channel (`stages`: the delay, then any blocks after it), each fed back into its own input
// (Feedback Mode NORMAL) or into the other channel's (CROSS), then the balance and the output EQ.
function stereoDelay(stages: (s: "L" | "R") => readonly { id: string; label: string; params: readonly string[] }[]): Flow {
  const side = (s: "L" | "R", row: number) => {
    const blocks = stages(s);
    const ids = blocks.map((b) => `${b.id}${s}`);
    const last = ids[ids.length - 1]!;
    const other = s === "L" ? "R" : "L";
    return parts([sum(`fb${s}`, 1.3, row), ...blocks.map((b, i) => fx(ids[i]!, at(2.2 + i * 1.05, row), b.label, b.params))], [
      edge(`in${s}`, `fb${s}`, { route: "vh" }),
      ...via([`fb${s}`, ...ids]),
      edge(last, `fb${s}`, { route: "loop", params: LOOP, up: s === "L", when: { param: "Feedback Mode", is: 0 } }),
      edge(last, `fb${other}`, { route: "loop", params: s === "L" ? LOOP : [], when: { param: "Feedback Mode", is: 1 } }),
      edge(last, `mix${s}`, { gains: [wet("Balance")] }),
    ]);
  };
  const col = 2.2 + stages("L").length * 1.05 + 0.3;
  return join(stereoIn(WIDE), side("L", 1), side("R", 2), parts([], dryPaths()), mixEnd(col, true, WIDE));
}

const FEEDBACK_MODE =
  "Where each side's repeats go: NORMAL back into their own side, CROSS into the other side, so the repeats " +
  "ping-pong between left and right.";

export const STEREO_DELAY: EfxHelp = {
  summary: "A separate delay on each channel, each with its own time and phase, sharing feedback, damping and EQ.",
  notes: [
    "For a ping-pong echo, set Feedback Mode to CROSS and make one side's time about half the other's (or 0 on one side).",
    "Slightly different left and right times (a few ms) on a short delay make a wide stereo double.",
    "Inverting one side's phase makes a mono sound seem to come from all around, but it can disappear in mono.",
  ],
  params: {
    "Feedback Mode": FEEDBACK_MODE,
    "Delay Left": "The left channel's delay time.",
    "Delay Right": "The right channel's delay time.",
    "Phase Left": "NORMAL, or INVERT to flip the left delay's polarity.",
    "Phase Right": "NORMAL, or INVERT to flip the right delay's polarity.",
  },
  flow: stereoDelay((s) => [{
    id: "delay", label: "Delay", params: s === "L" ? ["Delay Left", "Phase Left"] : ["Delay Right", "Phase Right"],
  }]),
};

export const MODULATION_DELAY: EfxHelp = {
  summary:
    "A stereo delay with the delayed sound modulated, so the repeats waver in pitch. Short times give a flanger-like " +
    "sweep; longer ones a chorused echo.",
  notes: [
    "A slow, shallow modulation on a long delay gives the gently wavering repeats of a worn tape echo.",
    "With very short times and some feedback it becomes a stereo flanger.",
  ],
  params: {
    "Feedback Mode": FEEDBACK_MODE,
    "Delay Left": "The left channel's delay time.",
    "Delay Right": "The right channel's delay time.",
  },
  flow: stereoDelay((s) => [
    { id: "delay", label: "Delay", params: [s === "L" ? "Delay Left" : "Delay Right"] },
    { id: "mod", label: "Modulation", params: ["Rate", "Depth", "Phase"] },
  ]),
};

// A delay with taps: summed to mono, fed back, each tap (`taps`) sent to the sides it names through the balance.
interface TapSpec {
  id: string;
  label: string;
  row: number;
  params: readonly string[];
  to: readonly ("L" | "R")[];
  level: string;
}

function tapDelay(label: string, params: readonly string[], taps: readonly TapSpec[], eq: boolean): Flow {
  const delay = withFeedback({ id: "delay", at: at(1.8, 1), label, params, from: "mono", loop: LOOP });
  const tapParts = parts(taps.map((t) => tap(t.id, at(4.3, t.row), t.label, { params: [...t.params, t.level], value: t.level })), [
    ...taps.map((t) => edge("delay", t.id)),
    ...taps.flatMap((t) => t.to.map((s) => edge(t.id, `mix${s}`, { route: "line", gains: [wet("Balance"), level(t.level)], quiet: true }))),
  ]);
  return join(monoIn(), delay, tapParts, parts([], dryPaths()), mixEnd(6.2, eq));
}

export const TRIPLE_TAP_DELAY: EfxHelp = {
  summary:
    "One delay heard three times: a left, a centre and a right repeat, each with its own time and level, sharing " +
    "one feedback loop. The times can be note values, to follow the tempo.",
  notes: [
    "Set the three times to note values (for example a quarter, a dotted eighth and an eighth) for rhythmic echoes " +
      "locked to the patch tempo.",
    "Start with Feedback low: with three taps going round, the echoes build up quickly.",
  ],
  params: {
    "Delay Left": "The time to the left repeat. Can be a note value, to follow the tempo.",
    "Delay Right": "The time to the right repeat. Can be a note value.",
    "Delay Center": "The time to the centre repeat. Can be a note value.",
    "Left Level": "The left repeat's level.",
    "Right Level": "The right repeat's level.",
    "Center Level": "The centre repeat's level.",
  },
  flow: tapDelay("Triple tap delay", [], [
    { id: "tapL", label: "Left", row: 0.45, params: ["Delay Left"], to: ["L"], level: "Left Level" },
    { id: "tapC", label: "Center", row: 1, params: ["Delay Center"], to: ["L", "R"], level: "Center Level" },
    { id: "tapR", label: "Right", row: 1.55, params: ["Delay Right"], to: ["R"], level: "Right Level" },
  ], true),
};

export const QUADRUPLE_TAP_DELAY: EfxHelp = {
  summary:
    "One delay heard four times, spread across the stereo field: 1 far left, 2 left of centre, 3 right of centre, " +
    "4 far right. Each has its own time and level; the times can be note values.",
  notes: [
    "With the four times at 1, 2, 3 and 4 sixteenths, the echo walks across the stereo field in time with the tempo.",
    "Turn a level down to 0 to leave out a tap.",
  ],
  params: {
    "Delay 1": "The time to repeat 1 (far left). Can be a note value, to follow the tempo.",
    "Delay 2": "The time to repeat 2 (left of centre). Can be a note value.",
    "Delay 3": "The time to repeat 3 (right of centre). Can be a note value.",
    "Delay 4": "The time to repeat 4 (far right). Can be a note value.",
    "Level 1": "Repeat 1's level.",
    "Level 2": "Repeat 2's level.",
    "Level 3": "Repeat 3's level.",
    "Level 4": "Repeat 4's level.",
  },
  flow: tapDelay("Quad tap delay", [], [
    { id: "tap1", label: "1", row: 0.3, params: ["Delay 1"], to: ["L"], level: "Level 1" },
    { id: "tap2", label: "2", row: 0.77, params: ["Delay 2"], to: ["L", "R"], level: "Level 2" },
    { id: "tap3", label: "3", row: 1.23, params: ["Delay 3"], to: ["L", "R"], level: "Level 3" },
    { id: "tap4", label: "4", row: 1.7, params: ["Delay 4"], to: ["R"], level: "Level 4" },
  ], false),
};

export const TIME_CONTROL_DELAY: EfxHelp = {
  summary:
    "A delay whose time can be changed while it plays, bending the pitch of the repeats like a tape echo's speed " +
    "control: longer times drop the pitch, shorter ones raise it.",
  notes: [
    "Assign Delay to a controller (the EFX control settings) and move it during sustained notes for tape-style " +
      "pitch swoops and dub effects.",
    "Acceleration sets how sudden the swoop is: low values glide slowly to the new time.",
  ],
  params: {
    Delay: "The delay time. Changing it while the delay plays bends the pitch of the repeats.",
    Acceleration: "How quickly the delay reaches a new time. The pitch bend lasts as long as the change.",
    Pan: "Where the repeats sit in the stereo field, L64 to 63R.",
  },
  flow: join(monoIn(), withFeedback({ id: "delay", at: at(1.8, 1), label: "Time control delay", params: ["Delay", "Acceleration"], from: "mono", loop: LOOP }),
    mixOut({ col: 4.4, dryL: "inL", dryR: "inR", wetL: "delay", balance: "Balance", eq: true, wetGains: pan("Pan") })),
};

function twoVoiceFlow(): Flow {
  const voice = (v: "A" | "B", row: number, balanceSide: GainSide) => {
    const p = tap(`v${v}`, at(3.6, row), `Voice ${v}`, { params: [`Coarse ${v}`, `Fine ${v}`, `Pre Delay ${v}`, `Pan ${v}`], value: `Coarse ${v}` });
    const to = (s: GainSide) => edge(`v${v}`, s === "left" ? "mixL" : "mixR", {
      route: "line", gains: [wet("Balance"), { param: "Level Balance", side: balanceSide }, { param: `Pan ${v}`, side: s }], quiet: true,
    });
    return parts([p], [edge("shift", `v${v}`), to("left"), to("right")]);
  };
  return join(monoIn(), parts([fx("shift", at(2.2, 1), "Pitch shifter", ["Mode"])], [edge("mono", "shift")]),
    voice("A", 0.5, "left"), voice("B", 1.5, "right"), parts([], dryPaths()), mixEnd(5.2));
}

const MODE = "The pitch shifter's mode, 1 to 5: higher modes respond more slowly but hold a steadier pitch.";

export const TWO_VOICE_PITCH_SHIFTER: EfxHelp = {
  summary:
    "Two pitch-shifted copies of the sound, each with its own interval, fine tuning, delay and pan, added to the " +
    "original: harmonies, octaves or a detuned double.",
  notes: [
    "Coarse +7 and +12 (or −12) give power-chord fifths and octaves from a single note.",
    "Small Fine values in opposite directions (say +8 and −8 cents), panned apart with a few ms of pre-delay, " +
      "make a wide, thick double without an obvious pitch change.",
    "Low modes track fast playing better; high modes suit slow, sustained parts.",
  ],
  params: {
    Mode: MODE,
    "Coarse A": "Voice A's pitch shift in semitones, from two octaves down to one up.",
    "Coarse B": "Voice B's pitch shift in semitones, from two octaves down to one up.",
    "Fine A": "Voice A's fine tuning, in 2-cent steps.",
    "Fine B": "Voice B's fine tuning, in 2-cent steps.",
    "Pan A": "Where voice A sits in the stereo field.",
    "Pan B": "Where voice B sits in the stereo field.",
    "Level Balance": "The blend of the two voices: A100:0B is voice A alone, A0:100B voice B alone.",
    Balance: "The blend of the original sound and the shifted voices. D100:0W is the original alone, D0:100W the voices alone.",
  },
  flow: twoVoiceFlow(),
};

export const FBK_PITCH_SHIFTER: EfxHelp = {
  summary:
    "A pitch shifter whose output is fed back into itself, so each repeat is shifted again: rising or falling " +
    "arpeggio-like cascades.",
  notes: [
    "Coarse +12 with plenty of Feedback and some Pre Delay gives a rising octave cascade; +7 or +5 climbs in fifths or fourths.",
    "A small Fine shift (no Coarse) with feedback gives a slowly spiralling, barber-pole chorus.",
  ],
  params: {
    Mode: MODE,
    Coarse: "The pitch shift in semitones, from two octaves down to one up.",
    Fine: "Fine tuning, in 2-cent steps.",
    "Pre Delay": "The delay before the shifted sound; with feedback, the time between each further shift.",
    Feedback: "How much of the shifted sound goes round to be shifted again. Negative values invert it.",
    Pan: "Where the shifted sound sits in the stereo field, L64 to 63R.",
  },
  flow: join(monoIn(), withFeedback({ id: "shift", at: at(1.8, 1), label: "Pitch shifter", params: ["Mode", "Coarse", "Fine", "Pre Delay"], from: "mono", loop: ["Feedback"] }),
    mixOut({ col: 4.4, dryL: "inL", dryR: "inR", wetL: "shift", balance: "Balance", eq: true, wetGains: pan("Pan") })),
};

const reverbFlow = (label: string, params: readonly string[]) => join(monoIn(), parts([fx("verb", at(2.3, 1), label, params)], [edge("mono", "verb")]),
  mixOut({ col: 4, dryL: "inL", dryR: "inR", wetL: "verb", balance: "Balance", eq: true }));

export const REVERB: EfxHelp = {
  summary:
    "A reverb in the EFX, separate from the patch's own reverb, so a patch can have two different spaces, or a " +
    "reverb with an EQ and pre-delay of its own.",
  notes: [
    "Use it for a special space on one tone (say a big hall on a lead) while the main reverb send handles the rest.",
    "Some pre-delay keeps the attack clear of the reverb, so the sound stays defined even with a long tail.",
  ],
  params: {
    Type:
      "The kind of space: ROOM1 a short, dense room; ROOM2 a short, sparse one; STAGE1 a stage with plenty of late " +
      "reverberation; STAGE2 one with strong early reflections; HALL1 a clear hall; HALL2 a rich one.",
    "Pre Delay": "The gap between the dry sound and the start of the reverb.",
    Time: "How long the reverb lasts.",
    "HF Damp": "Cuts the reverb's highs above this frequency: lower for a softer, darker space. BYPASS keeps it bright.",
  },
  flow: reverbFlow("Reverb", ["Type", "Pre Delay", "Time", "HF Damp"]),
};

export const GATE_REVERB: EfxHelp = {
  summary:
    "A reverb cut off abruptly after a set time instead of dying away, as on 80s drums; or played backwards, or " +
    "sweeping across the stereo field.",
  notes: [
    "NORMAL with a short Gate Time on a snare or tom gives the big, abruptly stopped 80s drum sound.",
    "REVERSE swells up into the note; with some Pre Delay it can sound like the reverb arrives before the hit.",
  ],
  params: {
    Type: "NORMAL a gated reverb; REVERSE a reverb that swells up instead of dying away; SWEEP1 moves from right to " +
      "left; SWEEP2 from left to right.",
    "Pre Delay": "The gap between the dry sound and the start of the reverb.",
    "Gate Time": "How long the reverb lasts before it is cut off.",
  },
  flow: reverbFlow("Gate reverb", ["Type", "Pre Delay", "Gate Time"]),
};
