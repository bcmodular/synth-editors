// The mixer, in the SP-404 desk's style: a strip per tone (ON, output, pan, sends, level), the chorus and reverb
// returns, and the master (patch level and pan) with the PATCH button for the patch-wide settings.

import { useCallback, useRef, useState } from "react";
import { getParam } from "../core/patch";
import { param } from "../core/paramValue";
import { ChannelFader } from "../ui/Knob";
import { useDismiss } from "../ui/useDismiss";
import { useEditor } from "./EditorContext";
import { ParamChoice, ParamFader, ParamKnob, ParamSwitch } from "./ParamControls";

export const TONE_COLOURS = ["#e6c27a", "#7fc4ea", "#e6a3c4", "#8fdcc4"];
const RETURN_COLOUR = "#a8b8ff";
const MASTER_COLOUR = "#7be890";

// A vertical fader bound to a parameter, with its value under it.
function LevelFader({ id, tone, colour, dim }: { id: string; tone?: number; colour: string; dim?: boolean }) {
  const { patch, setValue } = useEditor();
  const def = param(id);
  const value = getParam(patch, def, tone ?? 0);
  return (
    <>
      <ChannelFader label={def.name} value={value} min={def.min} max={def.max} color={colour} dim={dim}
        onChange={(v) => setValue(def, v, tone ?? 0)} />
      <span className="lv">{def.display(value)}</span>
    </>
  );
}

const OUTPUTS = ["MIX", "EFX", "DIR1", "DIR2"];

function ToneStrip({ tone }: { tone: number }) {
  const { patch, setValue } = useEditor();
  const on = getParam(patch, param("toneSwitch"), tone) === 1;
  const out = getParam(patch, param("outputAssign"), tone);
  const colour = TONE_COLOURS[tone]!;
  return (
    <div className="strip" style={{ ["--sc" as string]: colour }}>
      <div className="st-head">TONE {tone + 1}</div>
      <ParamSwitch def="toneSwitch" tone={tone} label="ON" />
      <select className="pick out" value={out} onChange={(e) => setValue(param("outputAssign"), Number(e.target.value), tone)}>
        {OUTPUTS.map((o, i) => <option key={o} value={i}>{o}</option>)}
      </select>
      <div className="st-knobs">
        <ParamKnob def="tonePan" tone={tone} label="PAN" />
        <ParamKnob def="mixEfxSend" tone={tone} label={out === 1 ? "EFX" : "MIX"} />
        <ParamKnob def="chorusSend" tone={tone} label="CHO" />
        <ParamKnob def="reverbSend" tone={tone} label="REV" />
      </div>
      <LevelFader id="toneLevel" tone={tone} colour={colour} dim={!on} />
    </div>
  );
}

function ReturnStrip({ title, id }: { title: string; id: string }) {
  return (
    <div className="strip ret" style={{ ["--sc" as string]: RETURN_COLOUR }}>
      <div className="st-head">{title}</div>
      <LevelFader id={id} colour={RETURN_COLOUR} />
    </div>
  );
}

// The patch-wide settings that don't need to be on screen all the time. Escape or a press outside closes it.
function PatchPopup() {
  const { patch } = useEditor();
  const followsSystem = getParam(patch, param("clockSource")) === 1;
  return (
    <div className="popup patch-pop">
      <h3>PATCH</h3>
      <ParamFader def="octaveShift" />
      <ParamFader def="bendUp" />
      <ParamFader def="bendDown" />
      <ParamChoice def="keyAssign" label="Keys" />
      <div className="row tight">
        <ParamSwitch def="soloLegato" label="LEGATO" />
        <ParamSwitch def="portamento" label="PORTA" />
      </div>
      <ParamFader def="portamentoTime" />
      <ParamChoice def="clockSource" />
      <div className={followsSystem ? "off" : ""}>
        <ParamFader def="tempo" />
      </div>
      <p className="note">
        {followsSystem
          ? "SYSTEM follows the JV's system clock, which follows incoming MIDI clock when SYSTEM › MIDI sets it to MIDI."
          : "PATCH uses this patch's own tempo, for tempo-synced LFOs, delays and tone delay."}
      </p>
    </div>
  );
}

function MasterStrip() {
  const [open, setOpen] = useState(false);
  const anchor = useRef<HTMLDivElement>(null);
  useDismiss(anchor, useCallback(() => setOpen(false), []));
  return (
    <div className="strip master" style={{ ["--sc" as string]: MASTER_COLOUR }}>
      <div className="st-head">PATCH</div>
      <div className="anchor" ref={anchor}>
        <button className={`btn ${open ? "sel" : ""}`} onClick={() => setOpen((o) => !o)}>SETTINGS…</button>
        {open && <PatchPopup />}
      </div>
      <div className="st-knobs">
        <ParamKnob def="patchPan" label="PAN" />
      </div>
      <LevelFader id="patchLevel" colour={MASTER_COLOUR} />
    </div>
  );
}

export function Mixer() {
  return (
    <section className="sec mixer">
      <header><h2>MIXER</h2></header>
      <div className="desk">
        {[0, 1, 2, 3].map((t) => <ToneStrip key={t} tone={t} />)}
        <ReturnStrip title="CHORUS" id="chorusLevel" />
        <ReturnStrip title="REVERB" id="reverbLevel" />
        <MasterStrip />
      </div>
    </section>
  );
}
