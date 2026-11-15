// The shape of a parameter row and the builders for the tables (params.ts, paramsMore.ts).

import { fmtOffset } from "./display";

export type ParamBlock = "common" | "tone";

export interface ParamDef {
  id: string;
  name: string;
  block: ParamBlock;
  offset: number;
  nibbled?: boolean; // a two-byte (#) value split into nibbles, high first, at offset and offset + 1
  min: number;
  max: number;
  display: (raw: number) => string;
  labels?: readonly string[]; // raw min…max for enums
  center?: number; // raw value shown as 0, for bipolar parameters
}

// --- Row builders ---

// Where a parameter lives and what it's called.
export interface Where {
  block: ParamBlock;
  id: string;
  name: string;
  offset: number;
}

export const common = (id: string, name: string, offset: number): Where => ({ block: "common", id, name, offset });
export const tone = (id: string, name: string, offset: number): Where => ({ block: "tone", id, name, offset });

export type Extra = Partial<Pick<ParamDef, "nibbled" | "center" | "display">>;

export function range(where: Where, min: number, max: number, extra: Extra = {}): ParamDef {
  const display = extra.display ?? (extra.center === undefined ? String : fmtOffset(extra.center));
  return { ...where, min, max, ...extra, display };
}

export function choice(where: Where, labels: readonly string[]): ParamDef {
  return { ...where, min: 0, max: labels.length - 1, labels, display: (raw) => labels[raw] ?? String(raw) };
}

export const level = (where: Where) => range(where, 0, 127);
export const depth = (where: Where) => range(where, 0, 126, { center: 63 }); // raw 0–126 shown as −63…+63
export const onOff = (where: Where) => choice(where, ["OFF", "ON"]);

// Consecutive envelope times or levels: ids and names numbered from 1, eg. "Pitch Env T1"…"T4".
export function envRows(first: Where, count: number, make: (where: Where) => ParamDef): ParamDef[] {
  return Array.from({ length: count }, (_, i) =>
    make({ ...first, id: `${first.id}${i + 1}`, name: `${first.name}${i + 1}`, offset: first.offset + i }));
}
