// Patch-bound controls: look up the ParamDef, read/write the patch, format with def.display,
// and take part in parameter-assign mode (click to assign, tags on assigned params).
import type { ReactNode } from "react";
import { getRaw } from "../core/patch";
import { paramById } from "../core/params";
import type { ParamDef } from "../core/params";
import { HFader, VFader } from "../ui/Fader";
import { LedButton } from "../ui/controls";
import { ASSIGN_SLOTS, useEditor } from "./EditorContext";

export function useParam(id: string) {
  const ed = useEditor();
  const def = paramById(id);
  const value = ed.patch ? getRaw(ed.patch, def) : (def.center ?? 0);
  return { def, value, disabled: !ed.patch, set: (raw: number) => ed.setParam(id, raw) };
}

function useAssignTags(def: ParamDef): string {
  const ed = useEditor();
  if (!ed.patch || def.assignId === undefined) return "";
  const patch = ed.patch;
  return ASSIGN_SLOTS.filter((s) => getRaw(patch, paramById(s.id)) === def.assignId)
    .map((s) => s.tag)
    .join("");
}

// In assign mode, clicks on an assignable param pick it instead of editing it.
export function Assignable(p: { def: ParamDef; className?: string; children: ReactNode }) {
  const ed = useEditor();
  const active = ed.armed !== null && p.def.assignId !== undefined;
  return (
    <div
      className={`${p.className ?? ""} ${active ? "assignable" : ""}`}
      onPointerDownCapture={(e) => {
        if (!active) return;
        e.stopPropagation();
        e.preventDefault();
        ed.assignTo(p.def);
      }}
      onClickCapture={(e) => active && e.stopPropagation()}
      title={active ? `Assign ${p.def.name}` : undefined}
    >
      {p.children}
    </div>
  );
}

export function ParamLabel(p: { def: ParamDef; text: string; width?: number }) {
  const tags = useAssignTags(p.def);
  return (
    <span className="lbl" style={p.width ? { width: p.width } : undefined}>
      {p.text}
      {[...tags].map((t) => (
        <span key={t} className="tag">
          {t}
        </span>
      ))}
    </span>
  );
}

// Label + horizontal fader row.
export function ParamH(p: { id: string; label: string; width?: number; labelWidth?: number }) {
  const { def, value, disabled, set } = useParam(p.id);
  return (
    <Assignable def={def} className="hrow">
      <ParamLabel def={def} text={p.label} width={p.labelWidth ?? 74} />
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
export function ParamV(p: { id: string; label: string; swId?: string; color?: "led" | "cyan"; height?: number }) {
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
        label={<ParamLabel def={def} text={p.label} />}
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
