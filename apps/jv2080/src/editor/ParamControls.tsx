// Controls bound to a parameter of the patch: a labelled bar fader, a segmented choice, a drop-down list, an on/off
// button and a knob. `tone` (0–3) picks the tone for tone parameters.

import { getParam } from "../core/patch";
import type { ParamDef } from "../core/params";
import { param } from "../core/paramValue";
import { LedButton, Segmented } from "../ui/controls";
import { HFader } from "../ui/Fader";
import { Knob } from "../ui/Knob";
import { useEditor } from "./EditorContext";

export interface BoundProps {
  def: ParamDef | string; // a definition, or a parameter id
  tone?: number;
  label?: string;
}

const defOf = (def: ParamDef | string) => (typeof def === "string" ? param(def) : def);

function useBound(props: BoundProps) {
  const { patch, setValue } = useEditor();
  const def = defOf(props.def);
  const tone = props.tone ?? 0;
  return { def, value: getParam(patch, def, tone), set: (v: number) => setValue(def, v, tone), label: props.label ?? def.name };
}

// The fader works from 0, so parameters that start higher (Tempo 20–250) are shifted by their minimum.
export function ParamFader(props: BoundProps) {
  const { def, value, set, label } = useBound(props);
  const { min } = def;
  return (
    <div className="prow">
      <span className="lbl">{label}</span>
      <HFader
        width="fill"
        value={value - min}
        max={def.max - min}
        center={def.center === undefined ? undefined : def.center - min}
        format={(raw) => def.display(raw + min)}
        onChange={(raw) => set(raw + min)}
      />
    </div>
  );
}

export function ParamChoice(props: BoundProps) {
  const { def, value, set, label } = useBound(props);
  const options = (def.labels ?? []).map((l, i) => ({ label: l, value: def.min + i }));
  return (
    <div className="prow">
      <span className="lbl">{label}</span>
      <Segmented options={options} value={value} onChange={set} />
    </div>
  );
}

export function ParamSelect(props: BoundProps) {
  const { def, value, set, label } = useBound(props);
  const values = Array.from({ length: def.max - def.min + 1 }, (_, i) => def.min + i);
  return (
    <div className="prow">
      <span className="lbl">{label}</span>
      <select className="pick" value={value} onChange={(e) => set(Number(e.target.value))}>
        {values.map((v) => <option key={v} value={v}>{def.display(v)}</option>)}
      </select>
    </div>
  );
}

export function ParamSwitch(props: BoundProps) {
  const { value, set, label } = useBound(props);
  return <LedButton label={label} on={value !== 0} onToggle={() => set(value ? 0 : 1)} />;
}

export function ParamKnob(props: BoundProps) {
  const { def, value, set, label } = useBound(props);
  return (
    <Knob label={label} value={value} min={def.min} max={def.max} reset={def.center ?? def.min} text={def.display(value)}
      onChange={set} />
  );
}
