// The row above the tones: the mixer, the EFX with its type's parameters, chorus over reverb, and the patch settings.

import { useState } from "react";
import { EFX_TYPES, efxStartValue, efxType } from "../core/efx";
import { efxGroupOf } from "../core/efxGroups";
import { getParam } from "../core/patch";
import { param } from "../core/paramValue";
import { Section } from "../ui/controls";
import { useEditor } from "./EditorContext";
import { ChorusView, ReverbView } from "./ChorusReverbViews";
import { EffectChooser } from "./EffectChooser";
import { isDemo } from "./demoPatch";
import { efxSlotParam } from "./efx/efxParams";
import { EfxView } from "./efx/EfxView";
import { Mixer } from "./Mixer";
import { ParamChoice, ParamKnob, ParamSelect } from "./ParamControls";
import { PatchSettings } from "./PatchSettings";

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
    // In demo mode there's no JV to answer, so the new type starts from neutral values.
    if (isDemo()) for (const p of EFX_TYPES[type]?.params ?? []) setValue(efxSlotParam(p), efxStartValue(p));
    else setTimeout(resync, RESYNC_AFTER_TYPE_MS);
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

// The type's own view, then where the EFX goes: its output and its sends, on one row.
function Efx() {
  return (
    <Section title="EFX" className="efx" extra={<EfxTypeButton />}>
      <EfxView />
      <div className="efx-out">
        <ParamChoice def="efxOutput" label="Output" />
        <ParamKnob def="efxMixSend" label="MIX" />
        <ParamKnob def="efxChorusSend" label="CHORUS" />
        <ParamKnob def="efxReverbSend" label="REVERB" />
      </div>
    </Section>
  );
}

function Chorus() {
  return (
    <Section title="CHORUS" className="chorus">
      <ChorusView />
      <ParamChoice def="chorusOutput" label="Output" />
    </Section>
  );
}

function Reverb() {
  return (
    <Section title="REVERB" className="reverb">
      <ParamChoice def="reverbType" label="Type" />
      <ReverbView />
      <ParamSelect def="reverbHfDamp" label="HF Damp" />
    </Section>
  );
}

export function CommonRow() {
  return (
    <div className="common-row">
      <Mixer />
      <Efx />
      <div className="stack">
        <Chorus />
        <Reverb />
      </div>
      <PatchSettings />
    </div>
  );
}
