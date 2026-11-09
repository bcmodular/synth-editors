// One pad's channel strip (84 px): pad label and MIDI note, sample name, AHR thumbnail, mute group, routing,
// pan, MUTE and the level fader.

import { memo } from "react";
import type { MixerPad, MixField, Routing } from "../core/mixer";
import { noteName, padNote, type PadMidiSettings } from "../core/padNotes";
import { ChannelFader, PanKnob, panText } from "../ui/controls";
import { bankColour, padLabel } from "./banks";

export interface StripProps {
  pad: MixerPad;
  midi: PadMidiSettings;
  selected: boolean;
  playing: boolean;
  hitSeq?: number; // changes on every hit of this pad, restarting the flash
  onValue: (pad: number, field: MixField, value: number) => void;
  onMute: (pad: number) => void;
}

const ROUTES: { value: Routing; label: string; className: string }[] = [
  { value: 0, label: "DRY", className: "rd" },
  { value: 1, label: "1", className: "r1" },
  { value: 2, label: "2", className: "r2" },
];
const MUTE_GROUPS = ["–", ..."ABCDEFGHIJ"];

// Attack, hold and release drawn as an envelope; hold runs 1–100, the others 0–127.
function AhrThumb({ attack, hold, release }: { attack: number; hold: number; release: number }) {
  const a = 1 + (attack / 127) * 24;
  const h = a + (hold / 100) * 24;
  const r = Math.min(71, h + (release / 127) * 24);
  return (
    <svg className="ahr" viewBox="0 0 72 26" preserveAspectRatio="none" aria-hidden>
      <polyline points={`1,24 ${a},3 ${h},3 ${r},24`} />
    </svg>
  );
}

function NoteLabel({ pad, midi }: { pad: number; midi: PadMidiSettings }) {
  const note = padNote(pad, midi);
  return <span className="nt">{note ? `${noteName(note.note)} · ${note.channel}` : "–"}</span>;
}

function RoutingButtons({ pad, routing, onValue }: { pad: number; routing: Routing } & Pick<StripProps, "onValue">) {
  return (
    <div className="rtx" role="group" aria-label={`${padLabel(pad)} routing`}>
      {ROUTES.map((r) => (
        <button key={r.value} className={`${r.className} ${routing === r.value ? "on" : ""}`}
          aria-pressed={routing === r.value} onClick={() => onValue(pad, "routing", r.value)}>
          {r.label}
        </button>
      ))}
    </div>
  );
}

function MuteGroup({ pad, group, onValue }: { pad: number; group: number } & Pick<StripProps, "onValue">) {
  return (
    <label className={`mg ${group ? "on" : ""}`}>
      MUTE GRP
      <select value={group} aria-label={`${padLabel(pad)} mute group`}
        onChange={(e) => onValue(pad, "muteGroup", Number(e.target.value))}>
        {MUTE_GROUPS.map((g, i) => <option key={g} value={i}>{g}</option>)}
      </select>
    </label>
  );
}

// The pad number lights while the pad sounds and flashes on each hit (the key restarts the animation).
function PadNumber({ pad, playing, hitSeq }: { pad: number; playing: boolean; hitSeq?: number }) {
  const flashing = hitSeq !== undefined;
  return (
    <span key={hitSeq ?? "idle"} className={`wpad ${playing ? "lit" : ""} ${flashing ? "flash" : ""}`}
      style={{ ["--bc" as string]: bankColour(pad) }}>
      {padLabel(pad)}
    </span>
  );
}

export const Strip = memo(function Strip({ pad, midi, selected, playing, hitSeq, onValue, onMute }: StripProps) {
  const { mix } = pad;
  const label = padLabel(pad.pad);
  return (
    <div className={`ws ${selected ? "sel" : ""} ${playing ? "play" : ""}`} data-pad={label}>
      <div className="wtop">
        <PadNumber pad={pad.pad} playing={playing} hitSeq={hitSeq} />
        <NoteLabel pad={pad.pad} midi={midi} />
      </div>
      <div className="nm1" title={pad.name}>{pad.name}</div>
      <AhrThumb attack={mix.attack} hold={mix.hold} release={mix.release} />
      <MuteGroup pad={pad.pad} group={mix.muteGroup} onValue={onValue} />
      <RoutingButtons pad={pad.pad} routing={mix.routing} onValue={onValue} />
      <div className="wrow">
        <PanKnob value={mix.pan} label={`${label} pan`} onChange={(v) => onValue(pad.pad, "pan", v)} />
        <span className="pv">{panText(mix.pan)}</span>
      </div>
      <button className={`mute ${pad.muted ? "on" : ""}`} aria-pressed={pad.muted} onClick={() => onMute(pad.pad)}>
        MUTE
      </button>
      <ChannelFader value={mix.level} color={bankColour(pad.pad)} dim={pad.muted} label={`${label} level`}
        onChange={(v) => onValue(pad.pad, "level", v)} />
      <div className="lv">{pad.muted ? `(${mix.level})` : mix.level}</div>
    </div>
  );
});
