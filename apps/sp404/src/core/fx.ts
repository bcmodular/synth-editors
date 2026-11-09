// Effect lookup, bus availability, step mapping and display text for the SP-404 MK2 FX parameters.
// Ported from the TouchOSC layout's control_mapper.lua.

import { EFFECTS } from "./effects";
import type { Bus, BusGroup, DisplayId, FormulaDisplay, FxDef, FxParam } from "./fxTypes";
import { VALUE_TABLES } from "./valueTables";

export { EFFECTS };

export function busGroup(bus: Bus): BusGroup {
  if (bus <= 2) return "bus12";
  return bus <= 4 ? "bus34" : "input";
}

// MIDI channel (0-based) the SP-404 listens on for a bus: BUS 1–4 = channels 1–4, INPUT FX = channel 5.
export const busChannel = (bus: Bus): number => bus - 1;

export function effectById(id: number): FxDef | undefined {
  return EFFECTS[id - 1];
}

export const cc83For = (fx: FxDef, bus: Bus): number => fx.cc83[busGroup(bus)];
export const canLoad = (fx: FxDef, bus: Bus): boolean => cc83For(fx, bus) !== 0;
export const effectsForBus = (bus: Bus): FxDef[] => EFFECTS.filter((fx) => canLoad(fx, bus));

export const syncParam = (fx: FxDef): FxParam | undefined => fx.params.find((p) => p.isSync);
export const isSyncOn = (raw: number): boolean => raw >= 64;

// ---- discrete steps

// Step that a raw value falls in: the last step whose start is ≤ raw.
export function stepIndex(starts: readonly number[], raw: number): number {
  let index = 0;
  starts.forEach((start, i) => {
    if (raw >= start) index = i;
  });
  return index;
}

export function stepRaw(starts: readonly number[], index: number): number {
  const i = Math.max(0, Math.min(starts.length - 1, index));
  return starts[i] ?? 0;
}

// The display, unit and steps a parameter uses now (they change with SYNC for rate and time parameters).
export interface ParamMode {
  display: DisplayId;
  unit?: string;
  starts?: readonly number[];
}

export function paramMode(p: FxParam, syncOn = false): ParamMode {
  if (p.sync && syncOn) return p.sync;
  return { display: p.display, unit: p.unit, starts: p.starts };
}

export const isDiscrete = (p: FxParam, syncOn = false): boolean => paramMode(p, syncOn).starts !== undefined;

// ---- display text

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const scaled = (raw: number, max: number): number => (raw === 127 ? max : Math.floor((raw / 127.5) * max));

const FORMULAS: Record<FormulaDisplay, (raw: number) => string | number> = {
  zeroOneHundred: (raw) => scaled(raw, 100),
  zeroSixty: (raw) => scaled(raw, 60),
  zeroNinetyNine: (raw) => scaled(raw, 99),
  db24: (raw) => (raw === 13 ? -19 : Math.floor((raw / 127.5) * 49) - 24),
  db48: (raw) => Math.floor((raw / 127.5) * 49),
  looperLength: (raw) => (raw === 127 ? 0.012 : Math.round((0.23 - (raw / 127.5) * 0.218) * 1000) / 1000).toFixed(3),
  root: (raw) => `${NOTE_NAMES[raw % 12]}${Math.floor(raw / 12) - 1}`,
};

function isFormula(display: DisplayId): display is FormulaDisplay {
  return display in FORMULAS;
}

// Raw value (0–127) → the text the SP-404 shows, without the unit.
export function displayText(mode: ParamMode, raw: number): string {
  const { display, starts } = mode;
  if (isFormula(display)) return String(FORMULAS[display](raw));
  const table: readonly (string | number)[] = VALUE_TABLES[display];
  const value = table[starts ? stepIndex(starts, raw) : raw] ?? raw;
  if (display === "balance") return `${100 - Number(value)}-${value}`;
  return String(value);
}

// Words such as FLAT or OFF don't take a unit.
const takesUnit = (text: string): boolean => !/^[A-Z]+$/.test(text);

function withUnit(text: string, unit: string | undefined): string {
  if (!unit || !takesUnit(text)) return text;
  return unit === "%" ? `${text}%` : `${text} ${unit}`;
}

export function displayValue(p: FxParam, raw: number, syncOn = false): string {
  const mode = paramMode(p, syncOn);
  return withUnit(displayText(mode, raw), mode.unit);
}

// Labels for every step of a discrete parameter (for button rows and grids).
export function stepLabels(p: FxParam, syncOn = false): string[] {
  const mode = paramMode(p, syncOn);
  return (mode.starts ?? []).map((start) => displayText(mode, start));
}

// Starting values for an effect nobody has set yet: the first step of a discrete parameter (OFF for
// switches), the middle of a continuous one. Placeholder until the device's own values are captured.
export function initialValues(fx: FxDef): number[] {
  return fx.params.map((p) => (p.starts ? stepRaw(p.starts, 0) : 64));
}
