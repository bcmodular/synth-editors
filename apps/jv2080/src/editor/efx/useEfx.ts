// The current EFX type's parameters for its view: each with its definition, raw value (within its range), display
// text, and how to set or drag it.

import { EFX_TYPES, type EfxParamDef, type EfxTypeDef } from "../../core/efx";
import { getParam } from "../../core/patch";
import type { ParamDef } from "../../core/params";
import { clampParam, param } from "../../core/paramValue";
import type { DragAxis } from "../../ui/dragXY";
import { useEditor } from "../EditorContext";
import { efxSlotParam } from "./efxParams";

export interface EfxParam {
  p: EfxParamDef;
  def: ParamDef;
  raw: number;
  text: string;
  set: (raw: number) => void;
  axis: (px: number) => DragAxis; // drag across `px` for the whole range
}

export type GetParam = (name: string) => EfxParam;

// A parameter's value in its own units: dB, %, semitones… for linear ones, otherwise the raw value.
export function amount(x: EfxParam): number {
  return x.p.kind === "linear" ? (x.p.first ?? 0) + x.raw * (x.p.step ?? 1) : x.raw;
}

// 0…1 across the parameter's raw range.
export const fraction = (x: EfxParam) => x.raw / Math.max(1, x.p.max);

export function useEfx(): { type: EfxTypeDef | undefined; typeRaw: number; params: EfxParam[]; get: GetParam } {
  const { patch, setValue } = useEditor();
  const typeRaw = getParam(patch, param("efxType"));
  const type = EFX_TYPES[typeRaw];
  const params = (type?.params ?? []).map((p): EfxParam => {
    const def = efxSlotParam(p);
    const raw = clampParam(def, getParam(patch, def));
    const set = (v: number) => setValue(def, v);
    return { p, def, raw, text: def.display(raw), set, axis: (px) => ({ value: raw, min: 0, max: p.max, px, onChange: set }) };
  });
  const get: GetParam = (name) => {
    const found = params.find((x) => x.p.name === name);
    if (!found) throw new Error(`EFX ${type?.name} has no parameter "${name}"`);
    return found;
  };
  return { type, typeRaw, params, get };
}
