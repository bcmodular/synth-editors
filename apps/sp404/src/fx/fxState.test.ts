import { describe, expect, it } from "vitest";
import { choose, emptyFxState, readFxState, setParam, startValues, toggleOn } from "./fxState";
import { effectById, effectsForBus } from "../core/fx";

const FILTER_DRIVE = 1;
const RESONATOR = 2;

describe("FX state", () => {
  it("starts every bus with no effect", () => {
    const s = emptyFxState();
    expect(s.buses[1]).toEqual({ fxId: 0, on: false, values: [] });
    expect(Object.keys(s.buses)).toEqual(["1", "2", "3", "4", "5"]);
  });

  it("chooses an effect with the designs' starting values, switched on", () => {
    const s = choose(emptyFxState(), 1, FILTER_DRIVE);
    expect(s.buses[1]).toEqual({ fxId: FILTER_DRIVE, on: true, values: [70, 50, 30, 64, 20, 80] });
  });

  it("brings an effect's values back when it's chosen again on the same bus", () => {
    let s = choose(emptyFxState(), 1, FILTER_DRIVE);
    s = setParam(s, 1, 0, 10);
    s = choose(s, 1, RESONATOR);
    s = choose(s, 1, FILTER_DRIVE);
    expect(s.buses[1]!.values[0]).toBe(10);
    expect(choose(s, 2, FILTER_DRIVE).buses[2]!.values[0]).toBe(70); // other buses keep their own
  });

  it("keeps ON/OFF when switching effect", () => {
    let s = toggleOn(choose(emptyFxState(), 3, FILTER_DRIVE), 3);
    s = choose(s, 3, RESONATOR);
    expect(s.buses[3]!.on).toBe(false);
  });

  it("clamps parameter values and ignores buses with no effect", () => {
    const s = choose(emptyFxState(), 1, FILTER_DRIVE);
    expect(setParam(s, 1, 0, 300).buses[1]!.values[0]).toBe(127);
    expect(setParam(emptyFxState(), 2, 0, 5)).toEqual(emptyFxState());
    expect(toggleOn(emptyFxState(), 2)).toEqual(emptyFxState());
  });

  it("refuses an effect the bus can't load", () => {
    const inputOnly = effectsForBus(5).find((fx) => !effectsForBus(1).includes(fx))!;
    expect(choose(emptyFxState(), 1, inputOnly.id)).toEqual(emptyFxState());
  });

  it("uses a starting value list only when it fits the effect", () => {
    expect(startValues(effectById(FILTER_DRIVE)!)).toHaveLength(6);
  });

  it("reads back a saved state and drops anything that doesn't fit", () => {
    const saved = choose(emptyFxState(), 5, effectsForBus(5)[0]!.id);
    expect(saved.buses[5]!.fxId).not.toBe(0);
    expect(readFxState(JSON.stringify(saved))).toEqual(saved);
    const bad = { buses: { 1: { fxId: 999, on: true, values: [] }, 2: { fxId: 1, on: true, values: [1] } } };
    expect(readFxState(JSON.stringify(bad))).toEqual(emptyFxState());
    expect(readFxState("nonsense")).toEqual(emptyFxState());
  });
});
