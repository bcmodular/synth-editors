// Looking parameters up, and reading and writing their values as bytes.

import { ALL_PARAMS, type ParamDef } from "./params";

const BY_ID = new Map(ALL_PARAMS.map((p) => [p.id, p]));

export function param(id: string): ParamDef {
  const p = BY_ID.get(id);
  if (!p) throw new Error(`unknown parameter "${id}"`);
  return p;
}

export const paramWidth = (p: ParamDef) => (p.nibbled ? 2 : 1);
export const clampParam = (p: ParamDef, value: number) => Math.max(p.min, Math.min(p.max, Math.round(value)));

// The parameter's value from a block's bytes.
export function readParam(bytes: readonly number[], p: ParamDef): number {
  const hi = bytes[p.offset] ?? 0;
  return p.nibbled ? ((hi & 0x0f) << 4) | ((bytes[p.offset + 1] ?? 0) & 0x0f) : hi;
}

// The bytes that encode a value (clamped to the parameter's range): one byte, or two nibbles high first.
export function encodeParam(p: ParamDef, value: number): number[] {
  const v = clampParam(p, value);
  return p.nibbled ? [v >> 4, v & 0x0f] : [v];
}
