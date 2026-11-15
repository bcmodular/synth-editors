// Help for the patch settings: how the keyboard and the bender reach the tones, and the clock (manual pp. 72–74).

import { at, edge, fx, node, parts, sum, type Flow } from "../efxHelp/flow";
import type { SectionHelp } from "./types";

function patchFlow(): Flow {
  const block = (id: string, col: number, label: string, params: readonly string[], value: string) =>
    ({ ...fx(id, at(col, 0), label, params), value });
  return parts([
    node("keys", "in", at(0.5, 0), { label: "Keys" }),
    block("octave", 1.7, "Octave", ["octaveShift"], "octaveShift"),
    block("voices", 3.25, "Keys", ["keyAssign", "soloLegato"], "keyAssign"),
    block("porta", 4.9, "Portamento", ["portamento", "portamentoTime", "portamentoMode", "portamentoType", "portamentoStart"], "portamento"),
    sum("pitch", 6.2, 0),
    node("tones", "out", at(6.8, 0), { label: "Tones" }),
    node("bender", "in", at(0.5, 1), { label: "Bender" }),
    { ...fx("bend", at(3.25, 1), "Bend range", ["bendUp", "bendDown"]), value: "bendUp" },
    node("clock", "in", at(0.5, 2), { label: "System clock" }),
    { ...fx("tempo", at(3.25, 2), "Clock", ["clockSource", "tempo"]), value: "clockSource" },
    node("synced", "out", at(4.6, 2), { label: "Synced LFOs, EFX, tone delay" }),
  ], [
    edge("keys", "octave"), edge("octave", "voices"), edge("voices", "porta"), edge("porta", "pitch"), edge("pitch", "tones"),
    edge("bender", "bend"), edge("bend", "pitch", { control: true }),
    edge("clock", "tempo", { when: { param: "clockSource", is: 1 } }), edge("tempo", "synced"),
  ]);
}

export const PATCH_HELP: SectionHelp = {
  title: "Patch settings",
  summary:
    "Settings for the whole patch: how the keyboard and the bender play its tones, and which clock its tempo-synced " +
    "parts follow.",
  rows: [
    { label: "Octave", ids: ["octaveShift"], text: "Shifts the whole patch up or down by up to three octaves." },
    { label: "Bend Up", ids: ["bendUp"], text: "How far the bender raises the pitch at full travel, in semitones (12 is an octave)." },
    { label: "Bend Down", ids: ["bendDown"], text: "How far the bender lowers the pitch at full travel, in semitones, up to four octaves." },
    { label: "Keys", ids: ["keyAssign"], text: "POLY plays chords; SOLO plays one note at a time (the last one played), as on a sax or flute." },
    { label: "Legato", ids: ["soloLegato"], text: "With SOLO: a key played while another is held changes the pitch without restarting the note, like a guitarist's hammer-on." },
    { label: "Porta", ids: ["portamento"], text: "Portamento: the pitch glides from one note to the next. It works in POLY as well as SOLO." },
    { label: "Porta Time", ids: ["portamentoTime"], text: "How long the glide takes." },
    { label: "Clock", ids: ["clockSource"], text: "PATCH uses this patch's Tempo; SYSTEM the JV's system tempo, which can follow MIDI clock from a sequencer." },
    { label: "Tempo", ids: ["tempo"], text: "This patch's tempo, used when Clock is PATCH." },
    { label: "Porta mode", ids: ["portamentoMode"], text: "NORMAL glides between every note; LEGATO only between notes played overlapping." },
    { label: "Porta type", ids: ["portamentoType"], text: "RATE: the glide takes longer the further it goes; TIME: it takes the same time whatever the interval." },
    { label: "Porta start", ids: ["portamentoStart"], text: "Playing a new note mid-glide: PITCH starts from where the pitch is now; NOTE from the note it was heading to." },
    { label: "Priority", ids: ["voicePriority"], text: "When the JV runs out of its 64 voices: LAST keeps the newest notes, LOUDEST the loudest." },
    { label: "Stretch", ids: ["stretchTune"], text: "Piano-style stretched tuning: the bass a little flat and the treble a little sharp, as a tuner would set a piano. 3 is the most." },
    { label: "Analog Feel", ids: ["analogFeel"], text: "A slow, natural drift in pitch, like an analogue synth's instability." },
    { label: "Category", ids: ["patchCategory"], text: "The patch's category, used by the JV's patch search (and by this editor's patch browser, to come)." },
  ],
  notes: [
    "SOLO with Legato and a short portamento is the classic monosynth lead: overlapping notes glide, separate ones restart.",
    "A bend range of +2 / −2 suits most playing; +12 / −12 gives guitar-style dive bombs.",
    "The tempo drives tempo-synced LFOs, the EFX types that can follow it (STEP-FLANGER's step rate, the tap " +
      "delays) and tone delay.",
  ],
  flow: patchFlow(),
};
