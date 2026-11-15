// Patch-bound controls: look up the ParamDef, read/write the patch, format with def.display,
// and take part in parameter-assign mode and CC learn (click to pick).
import type { ReactNode } from "react";
import { getRaw } from "../core/patch";
import { paramById } from "../core/params";
import type { ParamDef } from "../core/params";
import { HFader } from "../ui/Fader";
import { Knob } from "../ui/Knob";
import { LedButton } from "../ui/controls";
import { useEditor } from "./EditorContext";
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

// What a click on `def` does now: picks it (assign mode, if it's assignable; CC learn, any param), or nothing.
function picking(ed: Editor, def: ParamDef) {
  if (ed.learning) return { armed: true, pick: ed.learnTo, verb: "Learn a CC for" };
  if (ed.armed === null) return { armed: false, pick: null, verb: "" };
  return { armed: true, pick: def.assignId === undefined ? null : ed.assignTo, verb: "Assign" };
}

// In assign mode, clicks on an assignable param pick it instead of editing it; in CC learn, any param.
export function Assignable(p: { def: ParamDef; className?: string; children: ReactNode }) {
  const { armed, pick, verb } = picking(useEditor(), p.def);
  const blocking = (e: Blockable) => (armed || swallowing()) && block(e);
  return (
    <div
      className={`${p.className ?? ""} ${pick ? "assignable" : ""}`}
      onPointerDownCapture={(e) => {
        if (!pick) return blocking(e);
        block(e);
        swallowUntil = performance.now() + SWALLOW_MS;
        pick(p.def);
      }}
      onClickCapture={blocking}
      onDoubleClickCapture={blocking}
      onWheelCapture={(e) => armed && e.stopPropagation()}
      title={pick ? `${verb} ${p.def.name}` : undefined}
    >
      {p.children}
    </div>
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
    </Assignable>
  );
}

// A fader for a patch parameter (cross mod), in its section's colour.
export function ParamFader(p: { id: string; label: string; width: number; signColors?: boolean }) {
  const { def, value, disabled, set } = useParam(p.id);
  return (
    <Assignable def={def}>
      <HFader label={p.label} width={p.width} value={value} max={def.max} center={def.center} format={def.display}
        onChange={set} disabled={disabled} signColors={p.signColors} />
    </Assignable>
  );
}

export function ParamLed(p: { id: string; label: string }) {
  const { def, value, disabled, set } = useParam(p.id);
  return (
    <Assignable def={def} className="inline">
      <LedButton label={p.label} on={value !== 0} disabled={disabled} onToggle={() => set(value ? 0 : 1)} />
    </Assignable>
  );
}
