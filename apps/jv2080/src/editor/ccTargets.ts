// What a learned CC can drive (after apps/tb3/src/editor/ccTargets.ts): a patch parameter, in one tone for a tone
// parameter, or a parameter of one EFX type, which only moves while that type is selected, so a knob never changes
// what can't be seen.
import type { CcMode } from "@synth-editors/cc-learn";
import { EFX_TYPES, type EfxParamDef } from "../core/efx";
import { getParam, type Patch } from "../core/patch";
import { ALL_PARAMS, type ParamDef } from "../core/params";
import { param } from "../core/paramValue";
import { efxSlotParam } from "./efx/efxParams";

// "param:<id>:<tone>" | "efx:<type>:<slot>"
export type CcTarget = string;

const PARAM_IDS = new Set(ALL_PARAMS.map((p) => p.id));

// A patch parameter's target; null for a parameter that isn't in the patch table (eg. an EFX slot's stand-in).
export const paramTarget = (def: ParamDef, tone = 0): CcTarget | null =>
  (PARAM_IDS.has(def.id) ? `param:${def.id}:${def.block === "tone" ? tone : 0}` : null);
export const efxTarget = (type: number, slot: number): CcTarget => `efx:${type}:${slot}`;

type Parsed = { kind: "param"; def: ParamDef; tone: number } | { kind: "efx"; type: number; p: EfxParamDef } | null;

export function parseTarget(t: CcTarget): Parsed {
  const m = /^(param|efx):([^:]+):(\d+)$/.exec(t);
  if (!m) return null;
  if (m[1] === "param") return PARAM_IDS.has(m[2]!) ? { kind: "param", def: param(m[2]!), tone: Number(m[3]) } : null;
  const type = Number(m[2]);
  const p = EFX_TYPES[type]?.params.find((x) => x.slot === Number(m[3]));
  return p ? { kind: "efx", type, p } : null;
}

export function targetLabel(t: CcTarget): string {
  const x = parseTarget(t);
  if (!x) return t;
  if (x.kind === "efx") return `EFX ${EFX_TYPES[x.type]!.name} · ${x.p.name}`;
  return x.def.block === "tone" ? `Tone ${x.tone + 1} · ${x.def.name}` : x.def.name;
}

// Every target can follow a knob, step with an encoder, or pick up.
export const MODES: readonly CcMode[] = ["relative", "pickup", "jump"];
export const DEFAULT_MODE: CcMode = "pickup";

// A target's value as the CC sees it, 0…max (the parameter's minimum taken away); null when it can't move now.
export interface TargetValue {
  current: number | null;
  max: number;
}

const efxTypeOf = (patch: Patch) => getParam(patch, param("efxType"));

// The parameter to write, its tone, and its minimum; null when the target can't move now (another EFX type).
function resolve(patch: Patch, t: CcTarget): { def: ParamDef; tone: number } | null {
  const x = parseTarget(t);
  if (!x) return null;
  if (x.kind === "param") return { def: x.def, tone: x.tone };
  return efxTypeOf(patch) === x.type ? { def: efxSlotParam(x.p), tone: 0 } : null;
}

export function readTarget(patch: Patch | null, t: CcTarget): TargetValue {
  const r = patch && resolve(patch, t);
  if (!r) return { current: null, max: 127 };
  return { current: getParam(patch, r.def, r.tone) - r.def.min, max: r.def.max - r.def.min };
}

export type SetValue = (def: ParamDef, value: number, tone?: number) => void;

export function writeTarget(patch: Patch | null, t: CcTarget, value: number, setValue: SetValue) {
  const r = patch && resolve(patch, t);
  if (r) setValue(r.def, value + r.def.min, r.tone);
}
