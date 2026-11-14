// EFX types and how their parameters display. EFX Type is Common offset 12 (raw 0–39); EFX Parameter n (slot n,
// 1–12) is Common offset 12 + n. The per-type tables come from the SysEx map via scripts/genTables.mjs; their wire
// order and raw ranges were measured on a JV-2080 by tgoelles (github.com/tgoelles/jv2080-max-for-live).

import { fmtPan, fmtSigned } from "./display";
import { EFX_TABLE } from "./efxTable";

// How a raw value maps to what the panel shows.
//   display  raw = shown value          list     raw indexes `labels`
//   linear   first + raw × step + unit  pan      L64…0…63R
//   balance  left(100−raw):(raw)right   unknown  raw range known, panel values not (rates in Hz, times in ms)
export type EfxValueKind = "display" | "list" | "linear" | "pan" | "balance" | "unknown";

export interface EfxParamDef {
  slot: number; // 1–12
  name: string; // as the panel abbreviates it, eg. "P1 Gain"
  full: string; // the manual's full name
  range: string; // the manual's display range, eg. "-15…+15 dB"
  kind: EfxValueKind;
  max: number; // highest raw value; the lowest is 0
  labels?: readonly string[];
  first?: number;
  step?: number;
  unit?: string;
  signed?: boolean;
  left?: string;
  right?: string;
}

export interface EfxTypeDef {
  name: string;
  params: readonly EfxParamDef[]; // in slot order; some types leave slots unused
}

export const EFX_TYPES: readonly EfxTypeDef[] = EFX_TABLE;
export const EFX_TYPE_OFFSET = 12;
export const EFX_PARAM_COUNT = 12;

export const efxParamOffset = (slot: number) => EFX_TYPE_OFFSET + slot; // slot 1–12

export function efxType(raw: number): EfxTypeDef | undefined {
  return EFX_TYPES[raw];
}

function linearValue(p: EfxParamDef, raw: number): string {
  const value = Math.round(((p.first ?? 0) + raw * (p.step ?? 1)) * 100) / 100;
  return `${p.signed ? fmtSigned(value) : value}${p.unit ?? ""}`;
}

const DISPLAY: Record<EfxValueKind, (p: EfxParamDef, raw: number) => string> = {
  display: (_, raw) => String(raw),
  list: (p, raw) => p.labels?.[raw] ?? String(raw),
  linear: linearValue,
  pan: (_, raw) => fmtPan(raw),
  balance: (p, raw) => `${p.left}${100 - raw}:${raw}${p.right}`,
  unknown: (_, raw) => `(${raw})`,
};

// What the panel would show. Values whose panel display isn't known yet show the raw value in brackets.
export function efxDisplay(p: EfxParamDef, raw: number): string {
  return DISPLAY[p.kind](p, Math.max(0, Math.min(p.max, raw)));
}
