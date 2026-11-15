// Help for the mixer: how each tone reaches the outputs, the EFX, the chorus and the reverb, and the patch's master
// level and pan (manual pp. 25–27, 72, 85).

import { at, edge, fx, node, parts, sum, tap, type Flow } from "../efxHelp/flow";
import type { SectionHelp } from "./types";

const CHORUS_TO_MIX = [0, 2]; // Chorus Output MIX, MIX+REV
const CHORUS_TO_REVERB = [1, 2]; // REV, MIX+REV

function mixerFlow(): Flow {
  return parts([
    node("tones", "in", at(0.4, 0), { label: "Tones 1–4" }),
    fx("tone", at(1.6, 0), "Level · Pan", ["toneLevel", "tonePan", "toneSwitch"]),
    tap("assign", at(3, 0), "Output", { params: ["outputAssign", "mixEfxSend"] }),
    node("direct", "out", at(4.4, 0.5), { label: "D1 / D2 outs" }),
    fx("efx", at(4.4, 1), "EFX"),
    fx("chorus", at(4.4, 2), "Chorus"),
    fx("reverb", at(4.4, 3), "Reverb"),
    sum("mix", 5.9, 0),
    { ...fx("master", at(7.1, 0), "Patch", ["patchLevel", "patchPan"]), value: ["patchLevel", "patchPan"] },
    node("out", "out", at(8.3, 0), { label: "Mix out" }),
  ], [
    edge("tones", "tone"), edge("tone", "assign"),
    edge("assign", "mix"), edge("assign", "efx"), edge("assign", "direct"),
    edge("tone", "chorus", { route: "vh" }), edge("tone", "reverb", { route: "vh" }),
    edge("efx", "mix", { gains: [{ param: "efxMixSend", tag: "EFX" }] }),
    edge("chorus", "mix", { gains: [{ param: "chorusLevel", tag: "Return" }], when: { param: "chorusOutput", is: CHORUS_TO_MIX } }),
    edge("chorus", "reverb", { when: { param: "chorusOutput", is: CHORUS_TO_REVERB } }),
    edge("reverb", "mix", { gains: [{ param: "reverbLevel", tag: "Return" }] }),
    edge("mix", "master"), edge("master", "out"),
  ]);
}

export const MIXER_HELP: SectionHelp = {
  title: "Mixer",
  summary:
    "Each tone's channel: its level and pan, where it goes (the main MIX output, through the EFX, or a direct " +
    "output), and how much of it is sent to the chorus and reverb. Then the chorus and reverb returns, and the " +
    "patch's own level and pan over everything.",
  rows: [
    {
      label: "Mix / EFX send", ids: ["mixEfxSend"], perTone: true,
      text: "How much of the tone goes on: to the MIX output, or into the EFX when Output is EFX (the knob is then " +
        "labelled EFX).",
    },
    { label: "Chorus send", ids: ["chorusSend"], perTone: true, text: "How much of the tone goes to the chorus." },
    { label: "Reverb send", ids: ["reverbSend"], perTone: true, text: "How much of the tone goes to the reverb." },
    { label: "Pan", ids: ["tonePan"], perTone: true, text: "The tone's place in the stereo field, L64 to 63R; the patch's pan is added to it." },
    {
      label: "Output", ids: ["outputAssign"], perTone: true,
      text: "MIX straight to the main output (with chorus and reverb); EFX through the EFX first (and the chorus and " +
        "reverb); D1 / D2 to a direct output, for an outboard effect, with no internal effects.",
    },
    {
      label: "Tone switch (MUTE)", ids: ["toneSwitch"], perTone: true,
      text: "Whether the tone plays: MUTE lit is OFF. Tones you don't use are best off: they still take polyphony.",
    },
    { label: "Level", ids: ["toneLevel"], perTone: true, text: "The tone's level against the others." },
    { label: "Chorus return", ids: ["chorusLevel"], text: "The chorus's output level (its Level)." },
    { label: "Reverb return", ids: ["reverbLevel"], text: "The reverb's output level (its Level)." },
    { label: "Patch pan", ids: ["patchPan"], text: "Moves the whole patch in the stereo field; added to each tone's pan." },
    { label: "Patch level", ids: ["patchLevel"], text: "The whole patch's level; each tone's level is scaled by it." },
  ],
  notes: [
    "RANGES in the header opens the four tones' key and velocity ranges: splits and velocity layers.",
    "SOLO is for listening only: it turns the other tones off on the JV while held, without changing the patch, and " +
      "puts them back when released.",
    "Rows for the tones show all four tones' values, tone 1 first.",
    "Keep basses and kick-like tones in the centre and with little reverb; spread pads and layers with pan for width.",
    "With Output set to D1 or D2 a tone skips the chorus and reverb as well as the EFX: use it to process one tone " +
      "outside the JV.",
  ],
  flow: mixerFlow(),
};
