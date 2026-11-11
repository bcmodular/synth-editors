import { describe, expect, it } from "vitest";
import { effectById } from "../core/fx";
import {
  clearBus, currentPreset, currentScene, deletePresetAt, deleteSceneAt, hasDefaults, recallDefaults, recallPresetAt,
  recallSceneAt, setExclude, slotsOn, storeDefaultsOn, storePresetAt, storeSceneAt, type Locks,
} from "./fxLibrary";
import { applyMorph, morphTarget, startMorph } from "./fxMorph";
import { choose, emptyFxState, setParam, startValues, toggleOn, type FxState } from "./fxState";

const FILTER_DRIVE = 1;
const RESONATOR = 2;
const NONE: Locks = new Set();
const LOCK_1: Locks = new Set([1]);
const A = { bus: 1, slot: 0 } as const;

const withDrive = (): FxState => choose(emptyFxState(), 1, FILTER_DRIVE);

describe("presets", () => {
  it("stores the bus's values in a slot of its current effect and recalls them", () => {
    let s = storePresetAt(setParam(withDrive(), 1, 0, 10), A, NONE);
    expect(slotsOn(s, 1)[0]![0]).toBe(10);
    expect(currentPreset(s, 1)).toBe(0);
    s = setParam(s, 1, 0, 99);
    expect(currentPreset(s, 1)).toBeUndefined();
    s = recallPresetAt(s, A);
    expect(s.buses[1].values[0]).toBe(10);
    expect(slotsOn(choose(s, 1, RESONATOR), 1)[0]).toBeNull(); // presets are per effect
  });

  it("deletes a slot, and LOCK keeps a bus's presets from being stored or deleted", () => {
    const s = storePresetAt(withDrive(), A, NONE);
    expect(storePresetAt(withDrive(), A, LOCK_1)).toEqual(withDrive());
    expect(deletePresetAt(s, A, LOCK_1)).toBe(s);
    expect(slotsOn(deletePresetAt(s, A, NONE), 1)[0]).toBeNull();
  });

  it("keeps tuning parameters on recall with Exclude tuning on", () => {
    const fx = effectById(RESONATOR)!;
    const tuning = fx.params.findIndex((p) => p.tuning);
    let s = choose(emptyFxState(), 1, RESONATOR);
    s = storePresetAt(setParam(s, 1, tuning, 5), A, NONE);
    s = setExclude(setParam(s, 1, tuning, 90), 1, true);
    expect(recallPresetAt(s, A).buses[1].values[tuning]).toBe(90);
  });
});

describe("defaults", () => {
  it("DEF recalls the stored defaults, else the effect's starting values", () => {
    let s = setParam(withDrive(), 1, 0, 3);
    expect(recallDefaults(s, 1).buses[1].values).toEqual(startValues(effectById(FILTER_DRIVE)!));
    s = storeDefaultsOn(s, 1, NONE);
    expect(hasDefaults(s, 1)).toBe(true);
    expect(recallDefaults(setParam(s, 1, 0, 50), 1).buses[1].values[0]).toBe(3);
    expect(hasDefaults(storeDefaultsOn(withDrive(), 1, LOCK_1), 1)).toBe(false);
  });
});

describe("clearing a bus", () => {
  it("unloads the effect, keeping its values for next time, unless the bus is locked", () => {
    const s = setParam(withDrive(), 1, 0, 7);
    expect(clearBus(s, 1, LOCK_1)).toBe(s);
    const cleared = clearBus(s, 1, NONE);
    expect(cleared.buses[1]).toEqual({ fxId: 0, on: false, values: [] });
    expect(choose(cleared, 1, FILTER_DRIVE).buses[1].values[0]).toBe(7);
  });
});

describe("FX scenes", () => {
  it("stores all five buses and recalls them, leaving locked buses alone", () => {
    let s = choose(withDrive(), 3, FILTER_DRIVE);
    s = storeSceneAt(s, 4);
    expect(currentScene(s)).toBe(4);
    s = toggleOn(setParam(s, 3, 0, 1), 1);
    expect(currentScene(s)).toBeUndefined();
    const back = recallSceneAt(s, 4, LOCK_1);
    expect(back.buses[3].values[0]).toBe(70);
    expect(back.buses[1].on).toBe(false); // bus 1 is locked
    expect(recallSceneAt(s, 4, NONE).buses[1].on).toBe(true);
    expect(deleteSceneAt(s, 4).scenes[4]).toBeNull();
    expect(recallSceneAt(s, 5, NONE)).toBe(s); // an empty scene does nothing
  });
});

describe("morph", () => {
  it("blends from the bus's values towards the target preset", () => {
    let s = storePresetAt(setParam(withDrive(), 1, 0, 100), A, NONE);
    s = setParam(s, 1, 0, 0);
    expect(applyMorph(s, 1, startMorph(s, 1))).toBe(s); // no target yet
    const m = morphTarget(s, 1, 0);
    expect(applyMorph(s, 1, { ...m, amount: 0.25 }).buses[1].values[0]).toBe(25);
    expect(applyMorph(s, 1, { ...m, amount: 1 }).buses[1].values[0]).toBe(100);
  });
});
