// The patch-wide settings, always on screen at the end of the top row: knobs for octave, bend, portamento time and
// tempo, then keys, legato and portamento, and the clock source.

import { getParam } from "../core/patch";
import { param } from "../core/paramValue";
import { PATCH_HELP } from "../core/sectionHelp";
import { Section } from "../ui/controls";
import { HelpButton } from "./help/HelpPanel";
import { sectionContentHook } from "./help/sectionContent";
import { useEditor } from "./EditorContext";
import { ParamChoice, ParamKnob, ParamSwitch } from "./ParamControls";

const DEFAULT_TEMPO = 120; // where a double-click on Tempo returns

const PATCH_SIDE = { width: 342 };

// With an (i) opening its help beside a working copy of the section (`inHelp`).
export function PatchSettings({ inHelp = false }: { inHelp?: boolean }) {
  const { patch } = useEditor();
  const followsSystem = getParam(patch, param("clockSource")) === 1;
  const help = inHelp ? undefined : (
    <HelpButton label="the patch settings" useContent={sectionContentHook(PATCH_HELP)} side={<PatchSettings inHelp />} sideStyle={PATCH_SIDE} />
  );
  return (
    <Section title="PATCH" className="patch-set" extra={help}>
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
    </Section>
  );
}
