// Types for the SP-404 MK2 effects table (effects.ts) and the buses that load them.

import type { VALUE_TABLES } from "./valueTables";

// The six FX knobs, in order (Ctrl 1–6).
export const FX_CCS = [16, 17, 18, 80, 81, 82] as const;
export type FxCc = (typeof FX_CCS)[number];

export const CC_FX_ON = 19; // < 64 off, ≥ 64 on
export const CC_FX_SELECT = 83;

// Bus 1–4 = BUS 1–4, bus 5 = INPUT FX. Each group of buses has its own CC 83 numbering.
export type Bus = 1 | 2 | 3 | 4 | 5;
export const BUSES: readonly Bus[] = [1, 2, 3, 4, 5];
export type BusGroup = "bus12" | "bus34" | "input";

// Display mappings computed by formula rather than looked up in VALUE_TABLES.
export type FormulaDisplay = "zeroOneHundred" | "zeroSixty" | "zeroNinetyNine" | "db24" | "db48" | "looperLength" | "root";
export type DisplayId = keyof typeof VALUE_TABLES | FormulaDisplay;

// How a parameter reads while SYNC is on (its note-value list replaces the free value).
export interface SyncAlt {
  display: DisplayId;
  unit?: string;
  starts?: readonly number[];
}

export interface FxParam {
  cc: FxCc;
  key: string;
  label: string;
  display: DisplayId;
  unit?: string;
  // Skipped by preset recall when the bus has Exclude tuning on.
  tuning?: boolean;
  // This parameter is the effect's SYNC switch.
  isSync?: boolean;
  // Discrete parameter: raw value where each step starts (step i covers starts[i] … starts[i+1] − 1).
  starts?: readonly number[];
  // Set when the parameter follows the effect's SYNC switch.
  sync?: SyncAlt;
}

// An effect's id in the effects table (not its CC 83 number).
export type FxId = number;
// The six raw knob values (0–127) of an effect, in CC order.
export type FxValues = readonly number[];

export interface FxDef {
  id: FxId;
  name: string;
  // CC 83 value that selects the effect, per bus group; 0 = the effect can't load there.
  cc83: Record<BusGroup, number>;
  params: readonly FxParam[];
}
