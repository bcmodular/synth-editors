// Help for the 46 effects, shown by the (i) on each FX module: what the effect does, a row for each parameter with its
// current value and range, tips, and the buses that can load it.

import { canLoad, displayValue, isSyncOn, syncParam } from "../fx";
import { BUSES, type Bus, type FxDef } from "../fxTypes";
import { FX_HELP_01_12 } from "./fx01to12";
import { FX_HELP_13_24 } from "./fx13to24";
import { FX_HELP_25_35 } from "./fx25to35";
import { FX_HELP_36_46 } from "./fx36to46";
import type { FxHelp } from "./types";

export type { FxHelp } from "./types";

export const FX_HELP: Readonly<Record<number, FxHelp>> = {
  ...FX_HELP_01_12, ...FX_HELP_13_24, ...FX_HELP_25_35, ...FX_HELP_36_46,
};

export const fxHelp = (id: number): FxHelp | undefined => FX_HELP[id];

export interface HelpRow {
  key: string; // the parameter's key (core/effects.ts)
  label: string;
  text: string;
  value: string;
  range: string;
}

// A row per parameter, in the module's order, with its value now and its range (both as the SP-404 shows them, so a
// synced time reads in note values while SYNC is on).
export function helpRows(fx: FxDef, values: readonly number[]): HelpRow[] {
  const help = fxHelp(fx.id);
  const sync = syncParam(fx);
  const syncOn = sync ? isSyncOn(values[fx.params.indexOf(sync)] ?? 0) : false;
  return fx.params.map((p, i) => ({
    key: p.key,
    label: p.label,
    text: help?.params[p.key] ?? "",
    value: displayValue(p, values[i] ?? 0, syncOn),
    range: `${displayValue(p, 0, syncOn)} – ${displayValue(p, 127, syncOn)}`,
  }));
}

const BUS_NAMES: Record<Bus, string> = { 1: "Bus 1", 2: "Bus 2", 3: "Bus 3", 4: "Bus 4", 5: "Input FX" };

// Where the effect can go: "Bus 1, Bus 2, Bus 3, Bus 4" or "Input FX".
export const loadsOn = (fx: FxDef): string => BUSES.filter((b) => canLoad(fx, b)).map((b) => BUS_NAMES[b]).join(", ");
