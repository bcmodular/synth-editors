// Patch-bound controls: look up the ParamDef, read/write the patch, format with def.display,
// and take part in parameter-assign mode and CC learn (click to pick).
import type { ReactNode } from "react";
import { getRaw } from "../core/patch";
import { paramById } from "../core/params";
import type { ParamDef } from "../core/params";
import { HFader } from "../ui/Fader";
import { Knob } from "../ui/Knob";
import { LedButton } from "../ui/controls";
import { paramTarget } from "./ccTargets";
import type { CcTarget } from "./ccTargets";
import { useEditor } from "./EditorContext";
import { Lit } from "./help/Lit";
import type { Editor } from "./EditorContext";

export function useParam(id: string) {
  const ed = useEditor();
  const def = paramById(id);
  const value = ed.patch ? getRaw(ed.patch, def) : (def.center ?? 0);
  return { def, value, disabled: !ed.patch, set: (raw: number) => ed.setParam(id, raw) };
}

// After an assigning press, the rest of that click (click, dblclick, a second press) must not
// reach the control: assign mode has already been switched off by then.
const SWALLOW_MS = 400;
let swallowUntil = 0;
const swallowing = () => performance.now() < swallowUntil;

type Blockable = { stopPropagation(): void; preventDefault(): void };
const block = (e: Blockable) => {
  e.stopPropagation();
  e.preventDefault();
};

// What a control can be picked as: its name, its CC learn target, and what assign mode does with it (null: it
// isn't assignable).
export interface PickSpec {
  name: string;
  target: CcTarget;
  assign: (() => void) | null;
}

// What a click on the control does now: picks it (CC learn, anything; assign mode, if it's assignable), or nothing.
function picking(ed: Editor, spec: PickSpec) {
  if (ed.learning) return { armed: true, pick: () => ed.learnTo(spec.target), verb: "Learn a CC for" };
  if (ed.armed === null) return { armed: false, pick: null, verb: "" };
  return { armed: true, pick: spec.assign, verb: "Assign" };
}

// In assign mode, clicks on an assignable control pick it instead of editing it; in CC learn, any control.
export function Pickable(p: { spec: PickSpec; className?: string; children: ReactNode }) {
  const { armed, pick, verb } = picking(useEditor(), p.spec);
  const blocking = (e: Blockable) => (armed || swallowing()) && block(e);
  return (
    <div
      className={`${p.className ?? ""} ${pick ? "assignable" : ""}`}
      onPointerDownCapture={(e) => {
        if (!pick) return blocking(e);
        block(e);
        swallowUntil = performance.now() + SWALLOW_MS;
        pick();
      }}
      onClickCapture={blocking}
      onDoubleClickCapture={blocking}
      onWheelCapture={(e) => armed && e.stopPropagation()}
      title={pick ? `${verb} ${p.spec.name}` : undefined}
    >
      {p.children}
    </div>
  );
}

// A patch parameter's control: CC-learnable, and assignable when the param has an assign id.
export function Assignable(p: { def: ParamDef; className?: string; children: ReactNode }) {
  const ed = useEditor();
  const { def } = p;
  const assign = def.assignId === undefined ? null : () => ed.assignTo(def);
  return (
    <Pickable spec={{ name: def.name, target: paramTarget(def.id), assign }} className={p.className}>
      {p.children}
    </Pickable>
  );
}

// An encoder for a patch parameter, in its section's colour. `swId` dims it while that switch is off.
interface ParamKnobProps {
  id: string;
  label: string;
  swId?: string;
  size?: "xs" | "s" | "m";
  side?: boolean;
  bare?: boolean;
  signColors?: boolean;
}

export function ParamKnob(p: ParamKnobProps) {
  const { def, value, disabled, set } = useParam(p.id);
  const sw = useParam(p.swId ?? p.id);
  return (
    <Assignable def={def} className="knobcell">
      <Lit ids={[p.id, ...(p.swId ? [p.swId] : [])]}>
      <Knob
        label={p.label}
        value={value}
        max={def.max}
        center={def.center}
        format={def.display}
        onChange={set}
        disabled={disabled}
        dim={p.swId !== undefined && sw.value === 0}
        size={p.size}
        side={p.side}
        bare={p.bare}
        signColors={p.signColors}
      />
      </Lit>
    </Assignable>
  );
}

// A fader for a patch parameter (cross mod), in its section's colour.
export function ParamFader(p: { id: string; label: string; width: number; signColors?: boolean }) {
  const { def, value, disabled, set } = useParam(p.id);
  return (
    <Assignable def={def}>
      <Lit ids={[p.id]}>
      <HFader label={p.label} width={p.width} value={value} max={def.max} center={def.center} format={def.display}
        onChange={set} disabled={disabled} signColors={p.signColors} />
      </Lit>
    </Assignable>
  );
}

export function ParamLed(p: { id: string; label: string }) {
  const { def, value, disabled, set } = useParam(p.id);
  return (
    <Assignable def={def} className="inline">
      <Lit ids={[p.id]}>
        <LedButton label={p.label} on={value !== 0} disabled={disabled} onToggle={() => set(value ? 0 : 1)} />
      </Lit>
    </Assignable>
  );
}
