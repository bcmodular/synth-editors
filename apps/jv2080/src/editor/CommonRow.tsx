// The row above the tones: the mixer, the EFX with its type's parameters, chorus over reverb, and the patch settings.

import { useState } from "react";
import { EFX_TYPES, efxStartValue, efxType } from "../core/efx";
import { getParam } from "../core/patch";
import { param } from "../core/paramValue";
import { Section } from "../ui/controls";
import { PickTitle } from "../ui/PickTitle";
import { useEditor } from "./EditorContext";
import { ChorusView, ReverbView } from "./ChorusReverbViews";
import { EfxInfoButton } from "./efx/EfxInfo";
import { EffectChooser } from "./EffectChooser";
import { isDemo } from "./demoPatch";
import { efxSlotParam } from "./efx/efxParams";
import { EfxView } from "./efx/EfxView";
import { Mixer } from "./Mixer";
import { ParamChoice, ParamKnob, ParamSelect } from "./ParamControls";
import { PatchSettings } from "./PatchSettings";

// The JV keeps the previous type's parameter bytes when the type changes, which can mean nothing to the new type.
// So a new type is sent with neutral starting values for its parameters (core/efx efxStartValue), in order after
// the type, and the patch is read back once they've gone to confirm what the JV holds.
const RESYNC_AFTER_TYPE_MS = 300;

// The EFX type as the section's title, opening the chooser, as a tone's wave opens the wave library.
function EfxTitle() {
  const { patch, setValue, resync } = useEditor();
  const [open, setOpen] = useState(false);
  const raw = getParam(patch, param("efxType"));
  const pick = (type: number) => {
    setOpen(false);
    if (type === raw) return;
    setValue(param("efxType"), type);
    for (const p of EFX_TYPES[type]?.params ?? []) setValue(efxSlotParam(p), efxStartValue(p));
    if (!isDemo()) setTimeout(resync, RESYNC_AFTER_TYPE_MS);
  };
  return (
    <>
      <PickTitle hint="Choose an effect" onClick={() => setOpen(true)}>{efxType(raw)?.name ?? "EFX"}</PickTitle>
      {open && <EffectChooser current={raw} onPick={pick} onClose={() => setOpen(false)} />}
    </>
  );
}

// The type's own view, then where the EFX goes: its output and its sends, on one row. The help panel shows a copy
// of the section beside it (`inHelp`), without its own (i).
function Efx({ inHelp = false }: { inHelp?: boolean }) {
  return (
    <Section title={<EfxTitle />} className="efx" extra={inHelp ? undefined : <EfxInfoButton side={<Efx inHelp />} />}>
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
