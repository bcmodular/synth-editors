// The patch-wide settings, always on screen at the end of the top row: knobs for octave, bend, portamento time and
// tempo, then keys, legato and portamento, and the clock source.

import { getParam } from "../core/patch";
import { param } from "../core/paramValue";
import { Section } from "../ui/controls";
import { useEditor } from "./EditorContext";
import { ParamChoice, ParamKnob, ParamSwitch } from "./ParamControls";

const DEFAULT_TEMPO = 120; // where a double-click on Tempo returns

export function PatchSettings() {
  const { patch } = useEditor();
  const followsSystem = getParam(patch, param("clockSource")) === 1;
  return (
    <Section title="PATCH" className="patch-set">
      <div className="patch-knobs">
        <ParamKnob def="octaveShift" />
        <ParamKnob def="bendUp" />
        <ParamKnob def="bendDown" />
        <ParamKnob def="portamentoTime" />
        <div className={followsSystem ? "off" : ""}>
          <ParamKnob def="tempo" reset={DEFAULT_TEMPO} />
        </div>
      </div>
      <ParamChoice def="keyAssign" label="Keys" />
      <div className="prow">
        <span className="lbl">Mode</span>
        <div className="row tight">
          <ParamSwitch def="soloLegato" label="LEGATO" />
          <ParamSwitch def="portamento" label="PORTA" />
        </div>
      </div>
      <ParamChoice def="clockSource" />
      <p className="note">
        {followsSystem
          ? "SYSTEM follows the JV's system clock, which follows incoming MIDI clock when SYSTEM › MIDI sets it to MIDI."
          : "PATCH uses this patch's own tempo, for tempo-synced LFOs, delays and tone delay."}
      </p>
    </Section>
  );
}
