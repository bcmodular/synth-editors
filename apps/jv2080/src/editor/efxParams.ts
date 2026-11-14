// EFX parameters as editor parameters: slot n of the current type is Common offset 12 + n, with the type's range
// and display.
import { efxDisplay, efxParamOffset, type EfxParamDef } from "../core/efx";
import { PAN_CENTRE } from "../core/display";
import type { ParamDef } from "../core/params";

export function efxSlotParam(p: EfxParamDef): ParamDef {
  const labels = p.kind === "list" ? p.labels : undefined;
  return {
    id: `efx${p.slot}`,
    name: p.name,
    block: "common",
    offset: efxParamOffset(p.slot),
    min: 0,
    max: p.max,
    labels,
    center: p.kind === "pan" ? PAN_CENTRE : undefined,
    display: (raw) => efxDisplay(p, raw),
  };
}
