// The patch-wide settings that don't need to be on screen all the time, behind a button in the header: octave,
// bend, keys, legato, portamento, clock source and tempo. Escape or a press outside closes the popup.

import { useCallback, useRef, useState } from "react";
import { getParam } from "../core/patch";
import { param } from "../core/paramValue";
import { useDismiss } from "../ui/useDismiss";
import { useEditor } from "./EditorContext";
import { ParamChoice, ParamFader, ParamSwitch } from "./ParamControls";

function SettingsPopup() {
  const { patch } = useEditor();
  const followsSystem = getParam(patch, param("clockSource")) === 1;
  return (
    <div className="popup patch-pop">
      <h3>PATCH SETTINGS</h3>
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

export function PatchSettings() {
  const [open, setOpen] = useState(false);
  const anchor = useRef<HTMLDivElement>(null);
  useDismiss(anchor, useCallback(() => setOpen(false), []));
  return (
    <div className="anchor settings" ref={anchor}>
      <button className={`btn ${open ? "sel" : ""}`} onClick={() => setOpen((o) => !o)}>SETTINGS…</button>
      {open && <SettingsPopup />}
    </div>
  );
}
