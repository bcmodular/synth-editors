// The row above the tones: patch-wide settings, the EFX with its type's parameters, chorus and reverb.

import { efxType } from "../core/efx";
import { getParam } from "../core/patch";
import type { ParamDef } from "../core/params";
import { param } from "../core/paramValue";
import { Section } from "../ui/controls";
import { useEditor } from "./EditorContext";
import { efxSlotParam } from "./efxParams";
import { ParamChoice, ParamFader, ParamSelect, ParamSwitch } from "./ParamControls";

function PatchCommon() {
  return (
    <Section title="PATCH COMMON" className="common">
      <ParamFader def="patchLevel" label="Level" />
      <ParamFader def="patchPan" label="Pan" />
      <ParamFader def="octaveShift" />
      <ParamFader def="bendUp" />
      <ParamFader def="bendDown" />
      <ParamChoice def="keyAssign" label="Keys" />
      <div className="row tight">
        <ParamSwitch def="soloLegato" label="LEGATO" />
        <ParamSwitch def="portamento" label="PORTA" />
      </div>
      <ParamFader def="portamentoTime" />
      <ParamFader def="tempo" />
    </Section>
  );
}

// A list parameter with few values reads best as buttons; long lists as a drop-down.
function EfxParam({ def }: { def: ParamDef }) {
  if (!def.labels) return <ParamFader def={def} />;
  return def.labels.length <= 5 ? <ParamChoice def={def} /> : <ParamSelect def={def} />;
}

function Efx() {
  const { patch } = useEditor();
  const type = efxType(getParam(patch, param("efxType")));
  return (
    <Section title={`EFX · ${type?.name ?? "?"}`} className="efx">
      <ParamSelect def="efxType" label="Type" />
      <div className="efx-params">
        {type?.params.map((p) => <EfxParam key={`${type.name}-${p.slot}`} def={efxSlotParam(p)} />)}
      </div>
      <ParamChoice def="efxOutput" label="Output" />
      <ParamFader def="efxMixSend" label="Mix Send" />
      <ParamFader def="efxChorusSend" label="Chorus Send" />
      <ParamFader def="efxReverbSend" label="Reverb Send" />
    </Section>
  );
}

function Chorus() {
  return (
    <Section title="CHORUS" className="chorus">
      <ParamFader def="chorusLevel" label="Level" />
      <ParamFader def="chorusRate" label="Rate" />
      <ParamFader def="chorusDepth" label="Depth" />
      <ParamFader def="chorusPreDelay" label="Pre-Delay" />
      <ParamFader def="chorusFeedback" label="Feedback" />
      <ParamChoice def="chorusOutput" label="Output" />
    </Section>
  );
}

function Reverb() {
  return (
    <Section title="REVERB" className="reverb">
      <ParamChoice def="reverbType" label="Type" />
      <ParamFader def="reverbLevel" label="Level" />
      <ParamFader def="reverbTime" label="Time" />
      <ParamSelect def="reverbHfDamp" label="HF Damp" />
      <ParamFader def="delayFeedback" label="Dly Feedback" />
    </Section>
  );
}

export function CommonRow() {
  return (
    <div className="common-row">
      <PatchCommon />
      <Efx />
      <Chorus />
      <Reverb />
    </div>
  );
}
