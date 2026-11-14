// The mixer, laid out like a small analogue desk (a Mackie 1202-VLZ): each tone a column of knobs (sends, then pan),
// its output buttons, MUTE and SOLO, and a level knob. Then the chorus and reverb returns as short faders, and the
// master (patch level and pan) with the SETTINGS popup for the patch-wide settings.

import { useCallback, useEffect, useRef, useState } from "react";
import { getParam, type Patch } from "../core/patch";
import { param } from "../core/paramValue";
import { Segmented } from "../ui/controls";
import { ChannelFader } from "../ui/Knob";
import { useDismiss } from "../ui/useDismiss";
import { MASTER_COLOUR, SECTION_COLOURS, TONE_COLOURS } from "./colours";
import { useEditor } from "./EditorContext";
import { ParamChoice, ParamFader, ParamKnob, ParamSwitch } from "./ParamControls";
import { soloedSwitches, toggleSolo } from "./solo";

const TONES = [0, 1, 2, 3];
const OUTPUTS = ["MIX", "EFX", "D1", "D2"];

// A vertical fader bound to a parameter, with its name and value.
function LevelFader({ id, colour, title }: { id: string; colour: string; title?: string }) {
  const { patch, setValue } = useEditor();
  const def = param(id);
  const value = getParam(patch, def);
  return (
    <div className="lvf" style={{ ["--sc" as string]: colour }}>
      {title && <span className="st-head">{title}</span>}
      <ChannelFader label={def.name} value={value} min={def.min} max={def.max} color={colour}
        onChange={(v) => setValue(def, v)} />
      <span className="lv">{def.display(value)}</span>
    </div>
  );
}

interface StripProps {
  tone: number;
  soloed: boolean;
  onSolo: () => void;
}

function ToneStrip({ tone, soloed, onSolo }: StripProps) {
  const { patch, setValue } = useEditor();
  const on = getParam(patch, param("toneSwitch"), tone) === 1;
  const out = getParam(patch, param("outputAssign"), tone);
  const colour = TONE_COLOURS[tone];
  return (
    <div className="strip" style={{ ["--sc" as string]: colour }}>
      <div className="st-head">TONE {tone + 1}</div>
      <div className="st-knobs">
        <ParamKnob def="mixEfxSend" tone={tone} label={out === 1 ? "EFX" : "MIX"} color={colour} />
        <ParamKnob def="chorusSend" tone={tone} label="CHORUS" color={SECTION_COLOURS.chorus} />
        <ParamKnob def="reverbSend" tone={tone} label="REVERB" color={SECTION_COLOURS.reverb} />
        <ParamKnob def="tonePan" tone={tone} label="PAN" />
      </div>
      <Segmented options={OUTPUTS.map((label, value) => ({ label, value }))} value={out}
        onChange={(v) => setValue(param("outputAssign"), v, tone)} />
      <div className="ms">
        <button className={`btn mute ${on ? "" : "on"}`} onClick={() => setValue(param("toneSwitch"), on ? 0 : 1, tone)}>MUTE</button>
        <button className={`btn solo ${soloed ? "on" : ""}`} onClick={onSolo}>SOLO</button>
      </div>
      <div className="st-level">
        <ParamKnob def="toneLevel" tone={tone} label="LEVEL" color={colour} />
      </div>
    </div>
  );
}

function Returns() {
  return (
    <div className="strip ret">
      <LevelFader id="chorusLevel" title="CHORUS" colour={SECTION_COLOURS.chorus} />
      <LevelFader id="reverbLevel" title="REVERB" colour={SECTION_COLOURS.reverb} />
    </div>
  );
}

// The patch-wide settings that don't need to be on screen all the time.
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
      <ParamKnob def="patchPan" label="PAN" />
      <LevelFader id="patchLevel" colour={MASTER_COLOUR} />
    </div>
  );
}

const toneSwitches = (patch: Patch) => TONES.map((t) => getParam(patch, param("toneSwitch"), t) === 1);

// While anything is soloed, sends the JV the soloed switches; when the last solo is released, or the mixer goes
// away mid-solo, the real ones.
function useSolo() {
  const { patch, sendParam } = useEditor();
  const [solo, setSolo] = useState<ReadonlySet<number>>(new Set());
  const switches = toneSwitches(patch);
  const key = switches.join();
  const real = useRef(switches);
  real.current = switches;
  const soloing = useRef(false);
  const send = useCallback((on: readonly boolean[]) => {
    on.forEach((isOn, tone) => sendParam(param("toneSwitch"), isOn ? 1 : 0, tone));
  }, [sendParam]);
  useEffect(() => {
    if (solo.size === 0 && !soloing.current) return;
    soloing.current = solo.size > 0;
    send(soloedSwitches(real.current, solo));
  }, [solo, key, send]);
  useEffect(() => () => {
    if (soloing.current) send(real.current);
  }, [send]);
  return { solo, toggle: (tone: number) => setSolo((s) => toggleSolo(s, tone)) };
}

export function Mixer() {
  const { solo, toggle } = useSolo();
  return (
    <section className="sec mixer">
      <header><h2>MIXER</h2></header>
      <div className="desk">
        {TONES.map((t) => <ToneStrip key={t} tone={t} soloed={solo.has(t)} onSolo={() => toggle(t)} />)}
        <Returns />
        <MasterStrip />
      </div>
    </section>
  );
}
