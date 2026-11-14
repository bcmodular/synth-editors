// EFX types and how their parameters display. EFX Type is Common offset 12 (raw 0–39); EFX Parameter n is Common
// offset 12 + n (raw 0–127). The per-type tables come from the SysEx map via scripts/genTables.mjs.

import { EFX_TABLE } from "./efxTable";

export type EfxParamKind = "raw" | "enum" | "unknown";

export interface EfxParamDef {
  name: string; // as the panel abbreviates it, eg. "P1 Gain"
  full: string; // the manual's full name
  range: string; // the manual's display range, eg. "-15…+15 dB"
  kind: EfxParamKind;
  labels?: readonly string[]; // for "enum": raw 0…n−1
}

export interface EfxTypeDef {
  name: string;
  params: readonly EfxParamDef[];
}

export const EFX_TYPES: readonly EfxTypeDef[] = EFX_TABLE;
export const EFX_TYPE_OFFSET = 12;
export const EFX_PARAM_COUNT = 12;

export const efxParamOffset = (index: number) => EFX_TYPE_OFFSET + 1 + index; // index 0–11

export function efxType(raw: number): EfxTypeDef | undefined {
  return EFX_TYPES[raw];
}

// The highest raw value worth sending: an enum's last label, otherwise the full 7 bits.
export function efxParamMax(p: EfxParamDef): number {
  return p.kind === "enum" && p.labels ? p.labels.length - 1 : 127;
}

// What the panel would show. Parameters whose mapping the manual doesn't give show the raw value.
export function efxDisplay(p: EfxParamDef, raw: number): string {
  if (p.kind === "enum") return p.labels?.[raw] ?? String(raw);
  return String(raw);
}
