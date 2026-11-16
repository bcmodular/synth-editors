// Controls bound to a parameter of the patch: a segmented choice, a drop-down list, an on/off
// button and a knob. `tone` (0–3) picks the tone for tone parameters.

import { getParam } from "../core/patch";
import type { ParamDef } from "../core/params";
import { clampParam, param } from "../core/paramValue";
import { LedButton, Segmented } from "../ui/controls";
import { Knob } from "../ui/Knob";
import { paramTarget } from "./ccTargets";
import { useEditor } from "./EditorContext";
import { Lit } from "./help/Lit";

export interface BoundProps {
  def: ParamDef | string; // a definition, or a parameter id
  tone?: number;
  label?: string;
}

const defOf = (def: ParamDef | string) => (typeof def === "string" ? param(def) : def);

// The value is shown within the parameter's range: a byte can hold more (eg. an EFX parameter left over from the
// previous EFX type, which the JV keeps when the type changes).
function useBound(props: BoundProps) {
  const { patch, setValue } = useEditor();
  const def = defOf(props.def);
  const tone = props.tone ?? 0;
  const value = clampParam(def, getParam(patch, def, tone));
  const cc = paramTarget(def, tone) ?? undefined; // what a learned CC would drive (ccTargets.ts)
  return { def, value, set: (v: number) => setValue(def, v, tone), label: props.label ?? def.name, cc };
}

export function ParamChoice(props: BoundProps) {
  const { def, value, set, label, cc } = useBound(props);
  const options = (def.labels ?? []).map((l, i) => ({ label: l, value: def.min + i }));
  return (
    <Lit ids={[def.id]}>
      <div className="prow" data-cc-target={cc}>
        <span className="lbl">{label}</span>
        <Segmented options={options} value={value} onChange={set} />
      </div>
    </Lit>
  );
}

export function ParamSelect(props: BoundProps) {
  const { def, value, set, label, cc } = useBound(props);
  const values = Array.from({ length: def.max - def.min + 1 }, (_, i) => def.min + i);
  return (
    <Lit ids={[def.id]}>
      <div className="prow" data-cc-target={cc}>
        <span className="lbl">{label}</span>
        <select className="pick" value={value} onChange={(e) => set(Number(e.target.value))}>
          {values.map((v) => <option key={v} value={v}>{def.display(v)}</option>)}
        </select>
      </div>
    </Lit>
  );
}

export function ParamSwitch(props: BoundProps) {
  const { def, value, set, label } = useBound(props);
  return <Lit ids={[def.id]}><LedButton label={label} on={value !== 0} onToggle={() => set(value ? 0 : 1)} /></Lit>;
}

// Double-click resets to `reset`, else the parameter's centre, else its minimum.
export function ParamKnob(props: BoundProps & { color?: string; reset?: number }) {
  const { def, value, set, label, cc } = useBound(props);
  const reset = props.reset ?? def.center ?? def.min;
  return (
    <Lit ids={[def.id]}>
      <Knob label={label} value={value} min={def.min} max={def.max} reset={reset} text={def.display(value)}
        color={props.color} onChange={set} ccTarget={cc} />
    </Lit>
  );
}
