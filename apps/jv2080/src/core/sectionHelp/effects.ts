// Help for the patch's chorus and reverb (manual pp. 25–27, 53–55). Each tone sends to them by its own sends, and the
// EFX by its; the chorus can go on into the reverb.

import { at, edge, fx, node, parts, sum, join, withFeedback, type Flow } from "../efxHelp/flow";
import type { SectionHelp } from "./types";

const CHORUS_TO_MIX = [0, 2]; // Chorus Output MIX, MIX+REV
const CHORUS_TO_REVERB = [1, 2]; // REV, MIX+REV
const DELAY_TYPES = [6, 7]; // Reverb Type DELAY, PAN-DLY

// The tones' sends and the EFX's into one sum; returns the parts and the sum's id.
function sends(efxSend: string, chorus = false): Flow {
  const ins = [node("tones", "in", at(0.4, 0), { label: "Tone sends" }), node("efx", "in", at(0.4, 2), { label: "EFX send" })];
  const edges = [edge("tones", "in"), edge("efx", "in", { gains: [{ param: efxSend, tag: "Send" }] })];
  if (chorus) {
    ins.push(node("chorus", "in", at(0.4, 1), { label: "Chorus" }));
    edges.push(edge("chorus", "in", { when: { param: "chorusOutput", is: CHORUS_TO_REVERB } }));
  }
  return parts([...ins, sum("in", 1.3, 1)], edges);
}

function chorusFlow(): Flow {
  const block = withFeedback({ id: "chorus", at: at(2, 1), label: "Chorus", params: ["chorusRate", "chorusDepth", "chorusPreDelay"],
    from: "in", loop: [] });
  block.edges[2] = { ...block.edges[2]!, gains: [{ param: "chorusFeedback", tag: "FB" }] };
  const outs = parts([node("mix", "out", at(4.6, 0), { label: "Mix out" }), node("reverb", "out", at(4.6, 2), { label: "Reverb" })], [
    edge("chorus", "mix", { gains: [{ param: "chorusLevel", tag: "Level" }], when: { param: "chorusOutput", is: CHORUS_TO_MIX } }),
    edge("chorus", "reverb", { gains: [{ param: "chorusLevel", tag: "Level" }], when: { param: "chorusOutput", is: CHORUS_TO_REVERB } }),
  ]);
  return join(sends("efxChorusSend"), block, outs);
}

function reverbFlow(): Flow {
  const block = withFeedback({ id: "reverb", at: at(2, 1), label: "Reverb", params: ["reverbType", "reverbTime", "reverbHfDamp"],
    from: "in", loop: [] });
  block.nodes[1] = { ...block.nodes[1]!, value: "reverbType" };
  block.edges[2] = { ...block.edges[2]!, gains: [{ param: "delayFeedback", tag: "FB" }], when: { param: "reverbType", is: DELAY_TYPES } };
  const out = parts([node("mix", "out", at(4.6, 1), { label: "Mix out" })], [
    edge("reverb", "mix", { gains: [{ param: "reverbLevel", tag: "Level" }] }),
  ]);
  return join(sends("efxReverbSend", true), block, out);
}

export const CHORUS_HELP: SectionHelp = {
  title: "Chorus",
  summary:
    "The patch's chorus: a short, gently moving delay mixed back in, for width and movement. Each tone's chorus send " +
    "(on its mixer strip) and the EFX's set how much of them goes in.",
  rows: [
    { label: "Rate", ids: ["chorusRate"], text: "How fast the chorus moves. Drag the waves in the drawing sideways." },
    { label: "Depth", ids: ["chorusDepth"], text: "How far it moves. Drag the waves up or down." },
    { label: "Pre-Delay", ids: ["chorusPreDelay"], text: "How far behind the dry sound the chorus is; more sounds more spacious. Drag the first tap sideways." },
    { label: "Feedback", ids: ["chorusFeedback"], text: "How much of the chorus goes round again, for a richer, more complex (and eventually flanger-like) sound. Drag the repeats up or down." },
    { label: "Output", ids: ["chorusOutput"], text: "Where the chorus goes: MIX to the main outputs, REV into the reverb only, MIX+REV to both." },
    { label: "Level", ids: ["chorusLevel"], text: "The chorus's level: its return fader on the mixer." },
  ],
  notes: [
    "A slow rate and moderate depth give a smooth ensemble; faster and deeper, a seasick wobble, good for effects.",
    "MIX+REV gives the chorused sound the room too, so it sits in the same space as the rest of the patch.",
    "Turn the chorus sends down on bass tones to keep the low end centred and solid.",
  ],
  flow: chorusFlow(),
};

export const REVERB_HELP: SectionHelp = {
  title: "Reverb",
  summary:
    "The patch's reverb, a room around the sound, or a delay. Each tone's reverb send (on its mixer strip), the " +
    "EFX's, and the chorus (if its output includes REV) feed it. Its output always goes to the main outputs.",
  rows: [
    {
      label: "Type", ids: ["reverbType"],
      text: "ROOM1 a short, dense room; ROOM2 a short, sparse one; STAGE1 a stage with plenty of late reverberation; " +
        "STAGE2 one with strong early reflections; HALL1 a clear hall; HALL2 a rich one; DELAY an echo; PAN-DLY an " +
        "echo moving between left and right.",
    },
    { label: "Time", ids: ["reverbTime"], text: "How long the reverb lasts; for DELAY and PAN-DLY, the time between echoes. Drag the tail sideways." },
    { label: "HF Damp", ids: ["reverbHfDamp"], text: "Cuts the reverb's highs above this frequency: lower is softer and darker, as in a real hall. BYPASS keeps it bright." },
    { label: "Delay Feedback", ids: ["delayFeedback"], text: "For DELAY and PAN-DLY: how many echoes follow. Drag the echoes up or down." },
    { label: "Level", ids: ["reverbLevel"], text: "The reverb's level: its return fader on the mixer." },
  ],
  notes: [
    "HF Damp around 4–8 kHz makes a long hall sound natural rather than splashy.",
    "PAN-DLY with a little feedback is a quick ping-pong echo that leaves the EFX free for something else.",
    "Keep reverb sends lower on bass and drum tones and higher on pads and leads, so the mix stays clear.",
  ],
  flow: reverbFlow(),
};
