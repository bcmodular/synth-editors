// Patch-bound controls: look up the ParamDef, read/write the patch, format with def.display,
// and take part in parameter-assign mode and CC learn (click to pick).
import type { ReactNode } from "react";
import { getRaw } from "../core/patch";
import { paramById } from "../core/params";
import type { ParamDef } from "../core/params";
import { HFader, VFader } from "../ui/Fader";
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

export function ParamLabel(p: { text: string; width?: number }) {
  return (
    <span className="lbl" style={p.width ? { width: p.width } : undefined}>
      {p.text}
    </span>
  );
}

// Label + horizontal fader row.
export function ParamH(p: { id: string; label: string; width?: number | "fill"; labelWidth?: number }) {
  const { def, value, disabled, set } = useParam(p.id);
  return (
    <Assignable def={def} className="hrow">
      <ParamLabel text={p.label} width={p.labelWidth ?? 74} />
      <HFader
        value={value}
        max={def.max}
        center={def.center}
        format={def.display}
        onChange={set}
        disabled={disabled}
        width={p.width}
      />
    </Assignable>
  );
}

// Vertical fader with optional LED-cap switch (another param id).
export function ParamV(p: { id: string; label: string; swId?: string; color?: "led" | "alt"; height?: number }) {
  const { def, value, disabled, set } = useParam(p.id);
  const sw = useParam(p.swId ?? p.id);
  const on = p.swId ? sw.value !== 0 : true;
  return (
    <Assignable def={def}>
      <VFader
        value={value}
        max={def.max}
        center={def.center}
        format={def.display}
        onChange={set}
        disabled={disabled}
        color={p.color}
        height={p.height}
        off={!on}
        led={p.swId ? { on, onToggle: () => sw.set(on ? 0 : 1) } : undefined}
        label={<ParamLabel text={p.label} />}
      />
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
