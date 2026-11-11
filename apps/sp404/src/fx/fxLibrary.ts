// The FX library's actions on the app's FX state (docs/sp404-design.md › FX, following the TouchOSC layout): presets
// (8 per effect per bus), defaults (DEF), clearing a bus and the 16 FX scenes, with the LOCK rules. Pure functions
// over FxState, built on core/fxModel.ts; useFx turns what changes into MIDI.

import { effectById } from "../core/fx";
import {
  allowedWhenLocked, deletePreset, presetSlots, pushRecent, recallScene, recallValues, storeDefaults, storePreset,
  storeScene, type BusAction, type PresetSlots,
} from "../core/fxModel";
import { BUSES, type Bus } from "../core/fxTypes";
import type { BusFx } from "../core/midi";
import { emptyBus, startValues, type FxState } from "./fxState";

// The buses LOCK protects.
export type Locks = ReadonlySet<Bus>;

const allowed = (locks: Locks, bus: Bus, action: BusAction) => !locks.has(bus) || allowedWhenLocked(action);

const withBus = (s: FxState, bus: Bus, b: BusFx): FxState => ({ ...s, buses: { ...s.buses, [bus]: b } });

const sameValues = (a: readonly number[], b: readonly number[]) => a.length === b.length && a.every((v, i) => v === b[i]);

// ---- presets

// The current effect's 8 slots on a bus (all empty with no effect).
export const slotsOn = (s: FxState, bus: Bus): PresetSlots => presetSlots(s.libs[bus], s.buses[bus].fxId);

export interface SlotRef {
  bus: Bus;
  slot: number;
}

export function storePresetAt(s: FxState, { bus, slot }: SlotRef, locks: Locks): FxState {
  const b = s.buses[bus];
  if (!b.fxId || !allowed(locks, bus, "store")) return s;
  return { ...s, libs: { ...s.libs, [bus]: storePreset(s.libs[bus], b.fxId, slot, b.values) } };
}

export function deletePresetAt(s: FxState, { bus, slot }: SlotRef, locks: Locks): FxState {
  if (!slotsOn(s, bus)[slot] || !allowed(locks, bus, "delete")) return s; // no effect: every slot is empty
  return { ...s, libs: { ...s.libs, [bus]: deletePreset(s.libs[bus], s.buses[bus].fxId, slot) } };
}

// Values to set, keeping tuning parameters when the bus has Exclude tuning on.
function recalled(s: FxState, bus: Bus, stored: readonly number[]): BusFx {
  const b = s.buses[bus];
  const fx = effectById(b.fxId);
  return fx ? { ...b, values: recallValues(fx, b.values, stored, s.exclude[bus]) } : b;
}

export function recallPresetAt(s: FxState, { bus, slot }: SlotRef): FxState {
  const stored = slotsOn(s, bus)[slot];
  return stored ? withBus(s, bus, recalled(s, bus, stored)) : s;
}

// The stored slot the bus's values match, if any: the preset that's "on".
export function currentPreset(s: FxState, bus: Bus): number | undefined {
  const i = slotsOn(s, bus).findIndex((v) => v !== null && sameValues(v, s.buses[bus].values));
  return i >= 0 ? i : undefined;
}

// ---- defaults

// DEF: the stored defaults, else the effect's starting values.
export function recallDefaults(s: FxState, bus: Bus): FxState {
  const fx = effectById(s.buses[bus].fxId);
  if (!fx) return s;
  return withBus(s, bus, recalled(s, bus, s.libs[bus].defaults[fx.id] ?? startValues(fx)));
}

export function storeDefaultsOn(s: FxState, bus: Bus, locks: Locks): FxState {
  const b = s.buses[bus];
  if (!b.fxId || !allowed(locks, bus, "store")) return s;
  return { ...s, libs: { ...s.libs, [bus]: storeDefaults(s.libs[bus], b.fxId, b.values) } };
}

export const hasDefaults = (s: FxState, bus: Bus): boolean => s.libs[bus].defaults[s.buses[bus].fxId] !== undefined;

// ---- clearing a bus: no effect (its values stay in the recent list for next time)

export function clearBus(s: FxState, bus: Bus, locks: Locks): FxState {
  const b = s.buses[bus];
  if (!b.fxId || !allowed(locks, bus, "clear")) return s;
  return { ...withBus(s, bus, emptyBus()), libs: { ...s.libs, [bus]: pushRecent(s.libs[bus], b.fxId, b.values) } };
}

export const setExclude = (s: FxState, bus: Bus, on: boolean): FxState => ({ ...s, exclude: { ...s.exclude, [bus]: on } });

// ---- FX scenes: all five buses (scene store captures locked buses too; recall leaves them alone)

export function storeSceneAt(s: FxState, slot: number): FxState {
  return { ...s, scenes: s.scenes.map((v, i) => (i === slot ? storeScene(s.buses) : v)) };
}

export function deleteSceneAt(s: FxState, slot: number): FxState {
  return s.scenes[slot] ? { ...s, scenes: s.scenes.map((v, i) => (i === slot ? null : v)) } : s;
}

export function recallSceneAt(s: FxState, slot: number, locks: Locks): FxState {
  const scene = s.scenes[slot];
  return scene ? { ...s, buses: recallScene(s.buses, scene, (bus) => locks.has(bus)) } : s;
}

const sameBus = (a: BusFx, b: BusFx) => a.fxId === b.fxId && a.on === b.on && sameValues(a.values, b.values);

// The stored scene every bus matches, if any.
export function currentScene(s: FxState): number | undefined {
  const i = s.scenes.findIndex((scene) => scene !== null && BUSES.every((bus) => sameBus(scene[bus], s.buses[bus])));
  return i >= 0 ? i : undefined;
}
