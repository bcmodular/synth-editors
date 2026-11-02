// Editor state shared by every section: the current patch, setters that also send to the TB-3,
// and parameter-assign mode.
import { createContext, useContext } from "react";
import type { EfxNum } from "../core/efx";
import type { Patch } from "../core/patch";
import type { ParamDef } from "../core/params";

// In display order: the pads on the first row, effect knob and XY mod on the second.
export const ASSIGN_SLOTS = [
  { id: "assign_pad_x", label: "PAD X" },
  { id: "assign_pad_y", label: "PAD Y" },
  { id: "assign_effect_knob", label: "EFFECT" },
  { id: "assign_xy_mod", label: "XY MOD" },
] as const;

export type AssignSlotId = (typeof ASSIGN_SLOTS)[number]["id"];

export interface Editor {
  patch: Patch | null; // null until the first Sync from TB-3
  setParam: (id: string, raw: number) => void;
  setEfxType: (efx: EfxNum, type: number) => void;
  setEfxByte: (efx: EfxNum, offset: number, raw: number) => void;
  armed: AssignSlotId | null;
  arm: (slot: AssignSlotId | null) => void;
  assignTo: (def: ParamDef) => void;
}

export const EditorContext = createContext<Editor | null>(null);

export function useEditor(): Editor {
  const e = useContext(EditorContext);
  if (!e) throw new Error("useEditor outside EditorContext");
  return e;
}
