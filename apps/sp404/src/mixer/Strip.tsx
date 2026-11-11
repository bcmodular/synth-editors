// One pad's channel strip (84 px): pad label and MIDI note, sample name, AHR thumbnail, mute group, routing,
// pan, MUTE and SOLO, and the level fader.

import { memo, useEffect, useState } from "react";
import type { KeyboardEvent, PointerEvent as ReactPointerEvent } from "react";
import type { MixerPad, MixField, Routing } from "../core/mixer";
import { noteName, padNote, type PadMidiSettings } from "../core/padNotes";
import { PAD_NAME } from "../core/serialNames";
import { ChannelFader, PanKnob, panText } from "../ui/controls";
import { NameEdit } from "../ui/NameEdit";
import { ahrCorners } from "./AhrEditor";
import { bankColour, padLabel } from "./banks";
import type { DeskPad } from "./mixerState";
import { MuteSolo } from "./MuteSolo";
import type { Audition } from "./usePadAudition";

export interface StripProps {
  pad: DeskPad;
  midi: PadMidiSettings;
  selected: boolean;
  playing: boolean;
  hitSeq?: number; // changes on every hit of this pad, restarting the flash
  held: boolean; // note-on seen and no note-off yet
  onValue: (pad: number, field: MixField, value: number) => void;
  onMute: (pad: number) => void;
  onSolo: (pad: number) => void;
  onEditAhr: (pad: number) => void;
  onRename: (pad: number, name: string) => void;
  audition: Audition;
}

const ROUTES: { value: Routing; label: string; className: string }[] = [
  { value: 0, label: "DRY", className: "rd" },
  { value: 1, label: "1", className: "r1" },
  { value: 2, label: "2", className: "r2" },
];
const MUTE_GROUPS = ["–", ..."ABCDEFGHIJ"];

// Attack, hold and release drawn as an envelope; click it to open the AHR editor.
function AhrThumb({ pad, mix, onEdit }: { pad: number; mix: MixerPad["mix"]; onEdit: (pad: number) => void }) {
  const { a, h, r } = ahrCorners(mix);
  const x = (v: number) => (v / 360) * 72;
  return (
    <button className="ahr" aria-label={`${padLabel(pad)} envelope`} onClick={() => onEdit(pad)}>
      <svg viewBox="0 0 72 26" preserveAspectRatio="none" aria-hidden>
        <polyline points={`${x(8)},24 ${x(a)},3 ${x(h)},3 ${x(r)},24`} />
      </svg>
    </button>
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

const MIN_LIT_MS = 150; // so a very short sample still shows

// Lit from each hit while the pad is held (note-on to note-off) and until its sample ends at normal speed, whichever
// is later: a one-shot plays on after its note-off. A gated pad with a long sample stays lit past its release; the
// gate setting isn't decoded from the pad block yet. Without the SP-404's MIDI the sample's length decides.
function useLitAfterHit(hitSeq: number | undefined, held: boolean, seconds: number): boolean {
  const [timed, setTimed] = useState(false);
  useEffect(() => {
    if (hitSeq === undefined) return;
    setTimed(true);
    const timer = setTimeout(() => setTimed(false), Math.max(MIN_LIT_MS, seconds * 1000));
    return () => clearTimeout(timer);
  }, [hitSeq, seconds]);
  return held || timed;
}

interface PadNumberProps {
  pad: number;
  playing: boolean; // what the status poll says
  hitSeq?: number;
  held: boolean;
  seconds: number;
  audition: Audition;
}

const PRESS_KEYS = new Set([" ", "Enter"]);

// Press and hold to play the pad (note on, then note off on letting go), by pointer or by Space / Enter.
function auditionHandlers(pad: number, { press, release }: Audition) {
  const up = () => release(pad);
  return {
    onPointerDown: (e: ReactPointerEvent<HTMLElement>) => {
      e.currentTarget.setPointerCapture(e.pointerId);
      press(pad);
    },
    onPointerUp: up,
    onPointerCancel: up,
    onLostPointerCapture: up,
    onKeyDown: (e: KeyboardEvent) => {
      if (PRESS_KEYS.has(e.key) && !e.repeat) press(pad);
    },
    onKeyUp: (e: KeyboardEvent) => {
      if (PRESS_KEYS.has(e.key)) up();
    },
    onBlur: up,
  };
}

// The pad number lights while the pad sounds and flashes on each hit (the key restarts the animation). Holding it
// plays the pad.
function PadNumber({ pad, playing, hitSeq, held, seconds, audition }: PadNumberProps) {
  const flashing = hitSeq !== undefined;
  const lit = useLitAfterHit(hitSeq, held, seconds) || playing;
  return (
    <button key={hitSeq ?? "idle"} className={`wpad ${lit ? "lit" : ""} ${flashing ? "flash" : ""}`}
      style={{ ["--bc" as string]: bankColour(pad) }} aria-label={`Play ${padLabel(pad)}`}
      title="Hold to play the pad on the SP-404" {...auditionHandlers(pad, audition)}>
      {padLabel(pad)}
    </button>
  );
}

export const Strip = memo(function Strip(props: StripProps) {
  const { pad, midi, selected, playing, hitSeq, held, onValue, onMute, onSolo, onEditAhr, onRename, audition } = props;
  const { mix } = pad;
  const label = padLabel(pad.pad);
  return (
    <div className={`ws ${selected ? "sel" : ""}`} data-pad={label}
      style={{ ["--bc" as string]: bankColour(pad.pad) }}>
      <div className="wtop">
        <PadNumber pad={pad.pad} playing={playing} hitSeq={hitSeq} held={held} seconds={pad.seconds}
          audition={audition} />
        <NoteLabel pad={pad.pad} midi={midi} />
      </div>
      <NameEdit className="nm1" value={pad.name} field={PAD_NAME} label={`${label} sample name`}
        onRename={(name) => onRename(pad.pad, name)} />
      <AhrThumb pad={pad.pad} mix={mix} onEdit={onEditAhr} />
      <MuteGroup pad={pad.pad} group={mix.muteGroup} onValue={onValue} />
      <RoutingButtons pad={pad.pad} routing={mix.routing} onValue={onValue} />
      <div className="wrow">
        <PanKnob value={mix.pan} label={`${label} pan`} onChange={(v) => onValue(pad.pad, "pan", v)} />
        <span className="pv">{panText(mix.pan)}</span>
      </div>
      <MuteSolo name={label} mute={pad.mute} solo={pad.solo} onMute={() => onMute(pad.pad)} onSolo={() => onSolo(pad.pad)} />
      <ChannelFader value={mix.level} color={bankColour(pad.pad)} dim={pad.muted} label={`${label} level`}
        onChange={(v) => onValue(pad.pad, "level", v)} />
      <div className="lv">{pad.muted ? `(${mix.level})` : mix.level}</div>
    </div>
  );
});
