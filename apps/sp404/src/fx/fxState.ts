// The five FX buses as the app holds them (the SP-404 reports nothing back): each bus's effect, ON/OFF and values,
// and per bus the values last used for each effect. Pure functions; useFx turns the changes into MIDI.

import { canLoad, effectById, initialValues } from "../core/fx";
import { chooseEffect, emptyBusLibrary, pushRecent, type BusLibrary, type Buses } from "../core/fxModel";
import { BUSES, type Bus, type FxDef, type FxId } from "../core/fxTypes";
import type { BusFx } from "../core/midi";
import { FX_LAYOUT } from "./fxLayout";

export interface FxState {
  buses: Buses;
  libs: Record<Bus, BusLibrary>;
}

const perBus = <T>(make: () => T): Record<Bus, T> =>
  Object.fromEntries(BUSES.map((b) => [b, make()])) as Record<Bus, T>;

export const emptyFxState = (): FxState => ({
  buses: perBus((): BusFx => ({ fxId: 0, on: false, values: [] })),
  libs: perBus(emptyBusLibrary),
});

// Values an effect starts from the first time it's chosen on a bus: the designs' starting values, else the
// core's placeholder (first step / middle).
export function startValues(fx: FxDef): number[] {
  const start = FX_LAYOUT[fx.id - 1]?.start;
  return start && start.length === fx.params.length ? [...start] : initialValues(fx);
}

// Choose an effect on a bus. It comes back with its last values on this bus (or its defaults, or its start).
export function choose(state: FxState, bus: Bus, fxId: FxId): FxState {
  const fx = effectById(fxId);
  if (!fx || !canLoad(fx, bus)) return state;
  const lib = state.libs[bus];
  const known = lib.recent.some((r) => r.fxId === fxId) || lib.defaults[fxId] !== undefined;
  const seeded = known ? lib : pushRecent(lib, fxId, startValues(fx));
  const prev = state.buses[bus];
  const chosen = chooseEffect(seeded, prev.fxId ? prev : { ...prev, on: true }, fxId);
  return { buses: { ...state.buses, [bus]: chosen.bus }, libs: { ...state.libs, [bus]: chosen.lib } };
}

const hasParam = (b: BusFx, index: number): boolean => b.fxId !== 0 && index >= 0 && index < b.values.length;

export function setParam(state: FxState, bus: Bus, index: number, raw: number): FxState {
  const b = state.buses[bus];
  if (!hasParam(b, index)) return state;
  const values = b.values.map((v, i) => (i === index ? Math.max(0, Math.min(127, Math.round(raw))) : v));
  return { ...state, buses: { ...state.buses, [bus]: { ...b, values } } };
}

export function toggleOn(state: FxState, bus: Bus): FxState {
  const b = state.buses[bus];
  if (!b.fxId) return state;
  return { ...state, buses: { ...state.buses, [bus]: { ...b, on: !b.on } } };
}

// ---- saving between runs (localStorage until the Phase 4 files)

const isBusFx = (v: unknown): v is BusFx => {
  const b = v as BusFx;
  return typeof b?.fxId === "number" && typeof b.on === "boolean" && Array.isArray(b.values);
};

// A stored bus, if its effect still exists, loads on that bus and has the right number of values.
function readBus(stored: unknown, bus: Bus): BusFx | undefined {
  if (!isBusFx(stored)) return undefined;
  const fx = effectById(stored.fxId);
  const fits = fx !== undefined && canLoad(fx, bus) && stored.values.length === fx.params.length;
  return fits ? stored : undefined;
}

const readLib = (stored: BusLibrary | undefined): BusLibrary | undefined =>
  stored && Array.isArray(stored.recent) ? { ...emptyBusLibrary(), ...stored } : undefined;

function parse(raw: string | null): Partial<FxState> {
  try {
    return JSON.parse(raw ?? "{}") as Partial<FxState>;
  } catch {
    return {};
  }
}

// A stored state, keeping only what still fits; anything else starts empty.
export function readFxState(raw: string | null): FxState {
  const state = emptyFxState();
  const stored = parse(raw);
  for (const bus of BUSES) {
    state.buses[bus] = readBus(stored.buses?.[bus], bus) ?? state.buses[bus];
    state.libs[bus] = readLib(stored.libs?.[bus]) ?? state.libs[bus];
  }
  return state;
}
