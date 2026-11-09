// FX presets, defaults, recent values, lock rules, FX scenes and morph. Pure functions over plain data,
// following the TouchOSC layout's behaviour (see docs/sp404-design.md).

import { effectById, initialValues, isSyncOn, syncParam } from "./fx";
import { BUSES, type Bus, type FxDef, type FxId, type FxParam, type FxValues } from "./fxTypes";
import type { BusFx } from "./midi";

export const PRESETS_PER_EFFECT = 8;
export const SCENE_COUNT = 16;
export const RECENT_LIMIT = 16;

export type PresetSlots = (number[] | null)[];
// A preset slot, 0–7.
export type SlotIndex = number;

// Library for one bus: presets and defaults keyed by effect id, most recent effect first.
export interface BusLibrary {
  presets: Record<number, PresetSlots>;
  defaults: Record<number, number[]>;
  recent: { fxId: FxId; values: number[] }[];
}

export const emptyBusLibrary = (): BusLibrary => ({ presets: {}, defaults: {}, recent: [] });

// ---- presets

export function presetSlots(lib: BusLibrary, fxId: FxId): PresetSlots {
  return lib.presets[fxId] ?? Array<null>(PRESETS_PER_EFFECT).fill(null);
}

export function storePreset(lib: BusLibrary, fxId: FxId, slot: SlotIndex, values: FxValues): BusLibrary {
  const slots = presetSlots(lib, fxId).map((v, i) => (i === slot ? [...values] : v));
  return { ...lib, presets: { ...lib.presets, [fxId]: slots } };
}

export function deletePreset(lib: BusLibrary, fxId: FxId, slot: SlotIndex): BusLibrary {
  const slots = presetSlots(lib, fxId).map((v, i) => (i === slot ? null : v));
  return { ...lib, presets: { ...lib.presets, [fxId]: slots } };
}

// Values after recalling `stored`. With Exclude tuning on, tuning parameters keep their live values.
export function recallValues(fx: FxDef, live: FxValues, stored: FxValues, excludeTuning: boolean) {
  return fx.params.map((p, i) => (excludeTuning && p.tuning ? live[i] : stored[i]) ?? live[i] ?? 0);
}

// ---- recent values and choosing an effect

export function pushRecent(lib: BusLibrary, fxId: FxId, values: FxValues): BusLibrary {
  const rest = lib.recent.filter((r) => r.fxId !== fxId);
  return { ...lib, recent: [{ fxId, values: [...values] }, ...rest].slice(0, RECENT_LIMIT) };
}

// Values an effect starts with when chosen: its last values on this bus, else its defaults, else the
// app's starting values.
export function valuesForEffect(lib: BusLibrary, fx: FxDef): number[] {
  const recent = lib.recent.find((r) => r.fxId === fx.id);
  return [...(recent?.values ?? lib.defaults[fx.id] ?? initialValues(fx))];
}

// Switch a bus to another effect, remembering the outgoing effect's values.
export function chooseEffect(lib: BusLibrary, bus: BusFx, fxId: FxId): { lib: BusLibrary; bus: BusFx } {
  const fx = effectById(fxId);
  if (!fx) return { lib, bus };
  const kept = bus.fxId ? pushRecent(lib, bus.fxId, bus.values) : lib;
  return { lib: kept, bus: { fxId, on: bus.on, values: valuesForEffect(kept, fx) } };
}

export function storeDefaults(lib: BusLibrary, fxId: FxId, values: FxValues): BusLibrary {
  return { ...lib, defaults: { ...lib.defaults, [fxId]: [...values] } };
}

// ---- lock

export type BusAction =
  | "presetRecall" | "defaultsRecall" | "morph" | "onOff" | "sceneStore" // still work on a locked bus
  | "store" | "delete" | "clear" | "sceneRecall"; // leave a locked bus alone
const LOCKED_OUT = new Set<BusAction>(["store", "delete", "clear", "sceneRecall"]);
export const allowedWhenLocked = (action: BusAction): boolean => !LOCKED_OUT.has(action);

// ---- FX scenes: all five buses at once

export type Buses = Record<Bus, BusFx>;
export type FxScene = Buses;

export const storeScene = (buses: Buses): FxScene => structuredClone(buses);

// Locked buses keep what they have.
export function recallScene(buses: Buses, scene: FxScene, locked: (bus: Bus) => boolean): Buses {
  const out = { ...buses };
  for (const bus of BUSES) if (!locked(bus)) out[bus] = structuredClone(scene[bus]);
  return out;
}

// ---- morph

const lerp = (a: number, b: number, t: number): number => Math.round(a + (b - a) * t);

// Discrete while morphing: switches and stepped lists (a synced rate is stepped while SYNC is on).
function isStepped(p: FxParam, syncOn: boolean): boolean {
  return Boolean(p.isSync || p.starts || (p.sync?.starts && syncOn));
}

// A morph from a bus's live values towards a stored preset. `amount` runs 0–1.
export interface Morph {
  source: FxValues;
  target: FxValues;
  amount: number;
  excludeTuning: boolean;
}

// Blend live values towards a preset by the morph amount. Continuous parameters interpolate, stepped ones
// snap at the halfway point. With Exclude tuning on, tuning parameters stay put.
export function morphValues(fx: FxDef, { source, target, amount, excludeTuning }: Morph): number[] {
  const t = Math.max(0, Math.min(1, amount));
  const pick = (i: number) => ((t < 0.5 ? source[i] : target[i]) ?? 0);
  const syncIndex = fx.params.findIndex((p) => p === syncParam(fx));
  const syncOn = syncIndex >= 0 && isSyncOn(pick(syncIndex));
  return fx.params.map((p, i) => {
    const s = source[i] ?? 0;
    if (excludeTuning && p.tuning) return s;
    return isStepped(p, syncOn) ? pick(i) : lerp(s, target[i] ?? s, t);
  });
}
