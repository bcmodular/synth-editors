// A setting the rig file wants on the desk: the address, the value, which area of the plan it belongs to, and when it
// is written (docs/x32-spec.md, "Set up from the rig file": routing, links, buses and outputs, FX, card, then names,
// colours and icons).

import type { Param, Strip, StripKind } from "./addresses";
import type { OutputKind } from "./routing";
import type { DeskValue } from "./cache";

export type Area = "routing" | "channels" | "buses" | "outputs" | "fx" | "card";
export const AREAS: Area[] = ["routing", "channels", "buses", "outputs", "fx", "card"];

// 1 input routing, 2 links, 3 buses and outputs, 4 FX, 5 card, 6 names, colours, icons and mutes.
export type Step = 1 | 2 | 3 | 4 | 5 | 6;

export interface Target {
  area: Area;
  step: Step;
  param: Param;
  value: DeskValue;
  what: string; // for people: "ch 3 input ← aux in 5"
}

// at("routing", 1)(param, value, what): a target in an area, written at a step.
export const at = (area: Area, step: Step) => (param: Param, value: DeskValue, what: string): Target =>
  ({ area, step, param, value, what });

const KIND_LABEL: Record<StripKind, string> = { ch: "ch", auxin: "aux", fxrtn: "FX rtn", bus: "bus" };
export const label = (s: Strip) => `${KIND_LABEL[s.kind]} ${s.n}`;

const OUTPUT_LABEL: Record<OutputKind, string> = { main: "XLR out", aux: "aux out", p16: "P16" };
export const outputLabel = (kind: OutputKind, n: number) => `${OUTPUT_LABEL[kind]} ${n}`;
