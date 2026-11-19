// A value as the OSC argument its address takes. Type-only imports, so the fake desk can load it under plain Node.

import type { Param } from "./addresses";
import type { DeskValue } from "./cache";
import type { OscArg } from "./osc";

export function argFor(param: Param, value: DeskValue): OscArg {
  if (param.type === "s") return { type: "s", value: String(value) };
  if (typeof value !== "number") throw new Error(`${param.address} takes a number, not "${value}"`);
  return { type: param.type, value: param.type === "i" ? Math.round(value) : value };
}
