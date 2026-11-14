// The row above the tones: the mixer, the EFX with its type's parameters, chorus and reverb.

import { useState } from "react";
import { efxType } from "../core/efx";
import { efxGroupOf } from "../core/efxGroups";
import { getParam } from "../core/patch";
import type { ParamDef } from "../core/params";
import { param } from "../core/paramValue";
import { Section } from "../ui/controls";
import { useEditor } from "./EditorContext";
import { EffectChooser } from "./EffectChooser";
import { efxSlotParam } from "./efxParams";
import { Mixer } from "./Mixer";
import { ParamChoice, ParamFader, ParamSelect } from "./ParamControls";

// A list parameter with few values reads best as buttons; long lists as a drop-down.
function EfxParam({ def }: { def: ParamDef }) {
  if (!def.labels) return <ParamFader def={def} />;
  return def.labels.length <= 5 ? <ParamChoice def={def} /> : <ParamSelect def={def} />;
}

// A new type can bring the JV's defaults for its parameters, so the patch is read back shortly after.
const RESYNC_AFTER_TYPE_MS = 150;

function EfxTypeButton() {
  const { patch, setValue, resync } = useEditor();
  const [open, setOpen] = useState(false);
  const raw = getParam(patch, param("efxType"));
  const group = efxGroupOf(raw);
  const pick = (type: number) => {
    setOpen(false);
    if (type === raw) return;
    setValue(param("efxType"), type);
    setTimeout(resync, RESYNC_AFTER_TYPE_MS);
  };
  return (
    <>
      <button className="btn efx-type" style={{ ["--grp" as string]: group?.colour }} onClick={() => setOpen(true)}>
        {efxType(raw)?.name ?? "?"} ▾
      </button>
      {open && <EffectChooser current={raw} onPick={pick} onClose={() => setOpen(false)} />}
    </>
  );
}

function Efx() {
  const { patch } = useEditor();
  const type = efxType(getParam(patch, param("efxType")));
  return (
    <Section title="EFX" className="efx" extra={<EfxTypeButton />}>
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
      <ParamFader def="reverbTime" label="Time" />
      <ParamSelect def="reverbHfDamp" label="HF Damp" />
      <ParamFader def="delayFeedback" label="Dly Feedback" />
    </Section>
  );
}

export function CommonRow() {
  return (
    <div className="common-row">
      <Mixer />
      <Efx />
      <Chorus />
      <Reverb />
    </div>
  );
}
