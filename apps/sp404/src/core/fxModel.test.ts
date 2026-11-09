import { describe, expect, it } from "vitest";
import { effectById } from "./fx";
import {
  allowedWhenLocked, chooseEffect, deletePreset, emptyBusLibrary, morphValues, presetSlots, pushRecent, recallScene,
  recallValues, storeDefaults, storePreset, storeScene, valuesForEffect, RECENT_LIMIT, type Buses,
} from "./fxModel";
import type { BusFx } from "./midi";

const fx = (id: number) => {
  const found = effectById(id);
  if (!found) throw new Error(String(id));
  return found;
};
const RESONATOR = 2; // ROOT and CHORD are tuning parameters
const ZAN_ZOU = 10; // TIME follows SYNC (CC 82)

describe("presets", () => {
  it("has 8 empty slots per effect until one is stored", () => {
    const lib = emptyBusLibrary();
    expect(presetSlots(lib, 1)).toEqual(Array(8).fill(null));
    const stored = storePreset(lib, 1, 3, [1, 2, 3, 4, 5, 6]);
    expect(presetSlots(stored, 1)[3]).toEqual([1, 2, 3, 4, 5, 6]);
    expect(presetSlots(stored, 2)[3]).toBeNull();
    expect(presetSlots(deletePreset(stored, 1, 3), 1)[3]).toBeNull();
    expect(presetSlots(lib, 1)[3]).toBeNull(); // the original is untouched
  });

  it("recalls every parameter, or all but the tuning ones with Exclude tuning on", () => {
    const live = [60, 1, 2, 0, 4, 5];
    const stored = [72, 11, 12, 121, 14, 15];
    expect(recallValues(fx(RESONATOR), live, stored, false)).toEqual(stored);
    expect(recallValues(fx(RESONATOR), live, stored, true)).toEqual([60, 11, 12, 0, 14, 15]);
  });
});

describe("recent values and defaults", () => {
  it("keeps one entry per effect, most recent first, up to the limit", () => {
    let lib = emptyBusLibrary();
    for (let id = 1; id <= RECENT_LIMIT + 2; id++) lib = pushRecent(lib, id, [id]);
    expect(lib.recent).toHaveLength(RECENT_LIMIT);
    expect(lib.recent[0]?.fxId).toBe(RECENT_LIMIT + 2);
    lib = pushRecent(lib, 10, [99]);
    expect(lib.recent[0]).toEqual({ fxId: 10, values: [99] });
    expect(lib.recent.filter((r) => r.fxId === 10)).toHaveLength(1);
  });

  it("starts an effect from its recent values, then its defaults, then the starting values", () => {
    const lib = emptyBusLibrary();
    expect(valuesForEffect(lib, fx(4))).toEqual([64, 64, 64]);
    const withDefaults = storeDefaults(lib, 4, [1, 2, 3]);
    expect(valuesForEffect(withDefaults, fx(4))).toEqual([1, 2, 3]);
    expect(valuesForEffect(pushRecent(withDefaults, 4, [7, 8, 9]), fx(4))).toEqual([7, 8, 9]);
  });

  it("remembers the outgoing effect when choosing another", () => {
    const bus: BusFx = { fxId: 4, on: true, values: [10, 20, 30] };
    const first = chooseEffect(emptyBusLibrary(), bus, 1);
    expect(first.bus).toEqual({ fxId: 1, on: true, values: [64, 64, 64, 0, 64, 64] });
    const back = chooseEffect(first.lib, first.bus, 4);
    expect(back.bus.values).toEqual([10, 20, 30]);
    expect(chooseEffect(first.lib, first.bus, 99).bus).toBe(first.bus);
  });
});

describe("lock", () => {
  it("lets performance actions through and blocks edits and scene recall", () => {
    expect(["presetRecall", "defaultsRecall", "morph", "onOff", "sceneStore"].every((a) =>
      allowedWhenLocked(a as never))).toBe(true);
    expect(["store", "delete", "clear", "sceneRecall"].some((a) => allowedWhenLocked(a as never))).toBe(false);
  });
});

describe("FX scenes", () => {
  const bus = (fxId: number): BusFx => ({ fxId, on: true, values: [fxId] });
  const buses: Buses = { 1: bus(1), 2: bus(2), 3: bus(3), 4: bus(4), 5: bus(5) };

  it("stores a copy of all five buses", () => {
    const scene = storeScene(buses);
    expect(scene).toEqual(buses);
    expect(scene[1]).not.toBe(buses[1]);
  });

  it("skips locked buses on recall", () => {
    const scene = storeScene({ 1: bus(11), 2: bus(12), 3: bus(13), 4: bus(14), 5: bus(15) });
    const out = recallScene(buses, scene, (b) => b === 2);
    expect([1, 2, 3, 4, 5].map((b) => out[b as 1].fxId)).toEqual([11, 2, 13, 14, 15]);
  });
});

describe("morph", () => {
  const source = [60, 0, 0, 0, 0, 0];
  const target = [72, 100, 50, 121, 127, 20];
  const reso = (amount: number, excludeTuning = false) =>
    morphValues(fx(RESONATOR), { source, target, amount, excludeTuning });

  it("interpolates continuous parameters and snaps stepped ones at halfway", () => {
    expect(reso(0)).toEqual(source);
    expect(reso(1)).toEqual(target);
    expect(reso(0.25)).toEqual([63, 25, 13, 0, 32, 5]);
    expect(reso(0.5)).toEqual([66, 50, 25, 121, 64, 10]);
  });

  it("leaves tuning parameters alone with Exclude tuning on", () => {
    expect(reso(1, true)).toEqual([60, 100, 50, 0, 127, 20]);
  });

  it("steps a synced rate while SYNC is on and glides it while off", () => {
    const zanZouRate = (sync: number, amount: number) =>
      morphValues(fx(ZAN_ZOU), {
        source: [0, 0, 0, 0, 0, sync], target: [100, 0, 0, 0, 0, sync], amount, excludeTuning: false,
      })[0];
    expect(zanZouRate(0, 0.25)).toBe(25);
    expect(zanZouRate(64, 0.25)).toBe(0);
    expect(zanZouRate(64, 0.75)).toBe(100);
  });
});
