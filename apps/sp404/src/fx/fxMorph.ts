// Morph (EXPERIMENTAL in the UI): blends a bus's values towards one of its stored presets by an amount
// (docs/sp404-design.md › FX). Choosing a target starts the blend from the bus's values at that moment; switch-type
// parameters snap at halfway (core/fxModel.ts › morphValues). While morph is on, preset store and recall on the bus
// are off; turning it off keeps the blended values.

import { effectById } from "../core/fx";
import { morphValues } from "../core/fxModel";
import type { Bus } from "../core/fxTypes";
import { slotsOn } from "./fxLibrary";
import type { FxState } from "./fxState";

export interface BusMorph {
  slot?: number; // the target preset, once chosen
  source: readonly number[]; // the bus's values when the target was chosen
  amount: number; // 0–1
}

export const startMorph = (s: FxState, bus: Bus): BusMorph => ({ source: [...s.buses[bus].values], amount: 0 });

// A new target: the blend starts again from where the bus is now.
export const morphTarget = (s: FxState, bus: Bus, slot: number): BusMorph =>
  ({ slot, source: [...s.buses[bus].values], amount: 0 });

// The bus with its values blended by the morph.
export function applyMorph(s: FxState, bus: Bus, m: BusMorph): FxState {
  const b = s.buses[bus];
  const fx = effectById(b.fxId);
  const target = m.slot === undefined ? undefined : slotsOn(s, bus)[m.slot];
  if (!fx || !target) return s;
  const values = morphValues(fx, { source: m.source, target, amount: m.amount, excludeTuning: s.exclude[bus] });
  return { ...s, buses: { ...s.buses, [bus]: { ...b, values } } };
}
