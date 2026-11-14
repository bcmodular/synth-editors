// The patch-wide settings, always on screen at the end of the top row: octave, bend, keys, legato, portamento, clock
// source and tempo.

import { getParam } from "../core/patch";
import { param } from "../core/paramValue";
import { Section } from "../ui/controls";
import { useEditor } from "./EditorContext";
import { ParamChoice, ParamFader, ParamSwitch } from "./ParamControls";

export function PatchSettings() {
  const { patch } = useEditor();
  const followsSystem = getParam(patch, param("clockSource")) === 1;
  return (
    <Section title="PATCH" className="patch-set">
      <ParamFader def="octaveShift" />
      <ParamFader def="bendUp" />
      <ParamFader def="bendDown" />
      <ParamChoice def="keyAssign" label="Keys" />
      <div className="prow">
        <span className="lbl">Mode</span>
        <div className="row tight">
          <ParamSwitch def="soloLegato" label="LEGATO" />
          <ParamSwitch def="portamento" label="PORTA" />
        </div>
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
    </Section>
  );
}
