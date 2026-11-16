import { describe, expect, it, vi } from "vitest";
import type { Bus } from "../core/fxTypes";
import type { MidiMessage } from "../core/midi";
import { choose, emptyFxState, setParam, type FxState } from "../fx/fxState";
import {
  degreeOf, degreeStep, HYPER_RESO, keyAction, padAction, pressScalePad, RESONATOR, scaleOf, scaleStep, VOCODER,
  type KeysTarget,
} from "./keyboard";
import { KeyRouter, type RouterFx } from "./keyRouter";
import { MAX_VOICES, parseLaunchkey, Voices } from "./launchkey";

describe("keyboard", () => {
  it("counts Hyper-Reso degrees on the white keys from middle C, skipping 0", () => {
    expect(degreeOf(60)).toBe(1);
    expect(degreeOf(62)).toBe(2);
    expect(degreeOf(72)).toBe(8);
    expect(degreeOf(59)).toBe(-1);
    expect(degreeOf(48)).toBe(-7);
    expect(degreeOf(61)).toBeUndefined();
    expect(degreeOf(0)).toBe(-17);
    expect(degreeOf(127)).toBe(18);
    expect(degreeStep(-17)).toBe(0);
    expect(degreeStep(-1)).toBe(16);
    expect(degreeStep(1)).toBe(17);
    expect(degreeStep(18)).toBe(34);
  });

  it("steps the 24 scales as C–B major then C–B minor; pads change root or mode", () => {
    expect(scaleStep({ root: 2, minor: true })).toBe(14);
    expect(scaleOf(14)).toEqual({ root: 2, minor: true });
    expect(pressScalePad({ root: 2, minor: false }, 8)).toEqual({ root: 2, minor: true }); // MIN
    expect(pressScalePad({ root: 2, minor: true }, 2)).toEqual({ root: 1, minor: true }); // C#
    expect(pressScalePad({ root: 2, minor: true }, 1)).toBeUndefined();
  });

  it("routes keys by what the keyboard is on", () => {
    const bus = (b: Bus): KeysTarget => ({ kind: "bus", bus: b });
    expect(keyAction(bus(1), "resonator", 50)).toEqual({ kind: "param", index: 0, raw: 50 });
    expect(keyAction(bus(1), "hyperReso", 62)).toEqual({ kind: "param", index: 0, step: 18 });
    expect(keyAction(bus(1), "hyperReso", 61)).toBeUndefined();
    expect(keyAction(bus(5), "vocoder", 61)).toEqual({ kind: "play", channel: 10, note: 61 });
    expect(keyAction({ kind: "chromatic" }, undefined, 80)).toEqual({ kind: "play", channel: 15, note: 60 });
    expect(keyAction({ kind: "soundGen" }, undefined, 80)).toEqual({ kind: "play", channel: 15, note: 80 });
    expect(keyAction(undefined, undefined, 60)).toBeUndefined();
    expect(padAction("resonator", 15, { root: 0, minor: false })).toEqual({ kind: "param", index: 3, step: 15 });
    expect(padAction("vocoder", 10, { root: 0, minor: false })).toBeUndefined();
  });
});

describe("Launchkey", () => {
  it("reads keys, pads on channel 10, encoders on channel 1, the pedal and bend", () => {
    expect(parseLaunchkey([0x90, 60, 100])).toEqual({ type: "key", note: 60, velocity: 100 });
    expect(parseLaunchkey([0x81, 60, 64])).toEqual({ type: "key", note: 60, velocity: 0 });
    expect(parseLaunchkey([0x99, 40, 100])).toEqual({ type: "pad", pad: 0 });
    expect(parseLaunchkey([0x99, 36, 100])).toEqual({ type: "pad", pad: 8 });
    expect(parseLaunchkey([0x99, 36, 0])).toBeUndefined();
    expect(parseLaunchkey([0xb0, 26, 99])).toEqual({ type: "encoder", slot: 5, value: 99 });
    expect(parseLaunchkey([0xb1, 21, 99])).toBeUndefined();
    expect(parseLaunchkey([0xb0, 64, 127])).toEqual({ type: "sustain", down: true });
    expect(parseLaunchkey([0xe0, 0, 64])).toEqual({ type: "bend", lsb: 0, msb: 64 });
  });

  it("plays at most four voices, the oldest giving way; the pedal holds notes let go", () => {
    const v = new Voices();
    for (let i = 0; i < MAX_VOICES; i++) v.on({ channel: 10, note: 60 + i }, 100);
    expect(v.on({ channel: 10, note: 70 }, 100)).toEqual([[0x9a, 60, 0], [0x9a, 70, 100]]);
    expect(v.pedal(true, 10)).toEqual([[0xba, 64, 127]]);
    expect(v.off({ channel: 10, note: 61 })).toEqual([]);
    expect(v.pedal(false, 10)).toEqual([[0xba, 64, 0], [0x9a, 61, 0]]);
    expect(v.notes()).toEqual([62, 63, 70]);
    expect(v.flush()).toHaveLength(3);
  });
});

function router(state: FxState, target: KeysTarget | undefined) {
  const fx = { state, setValue: vi.fn() } as unknown as RouterFx & { setValue: ReturnType<typeof vi.fn> };
  const played: MidiMessage[] = [];
  const r = new KeyRouter({ fx: () => fx, target: () => target, play: (m) => played.push(...m) });
  return { r, fx, played };
}

describe("KeyRouter", () => {
  it("sets Resonator ROOT and CHORD; encoders set any slot", () => {
    const { r, fx } = router(choose(emptyFxState(), 1, RESONATOR), { kind: "bus", bus: 1 });
    r.key(57, 100);
    expect(fx.setValue).toHaveBeenLastCalledWith(1, 0, 57);
    r.key(57, 0);
    expect(fx.setValue).toHaveBeenCalledTimes(1);
    r.pad(2);
    expect(fx.setValue).toHaveBeenLastCalledWith(1, 3, 17);
    r.encoder(4, 90);
    expect(fx.setValue).toHaveBeenLastCalledWith(1, 4, 90);
  });

  it("sets Hyper-Reso NOTE and SCALE from the bus's scale now", () => {
    const state = setParam(choose(emptyFxState(), 3, HYPER_RESO), 3, 3, 59); // SCALE step 11: B major
    const { r, fx } = router(state, { kind: "bus", bus: 3 });
    r.key(60, 100);
    expect(fx.setValue).toHaveBeenLastCalledWith(3, 0, 62); // degree 1 = step 17
    r.pad(8); // MIN
    expect(fx.setValue).toHaveBeenLastCalledWith(3, 3, 123); // B minor = step 23
  });

  it("plays the Vocoder on INPUT FX on channel 11, with the pedal and bend", () => {
    const { r, played } = router(choose(emptyFxState(), 5, VOCODER), { kind: "bus", bus: 5 });
    r.key(64, 90);
    r.event({ type: "sustain", down: true });
    r.event({ type: "bend", lsb: 1, msb: 2 });
    r.release();
    expect(played).toEqual([[0x9a, 64, 90], [0xba, 64, 127], [0xea, 1, 2], [0x9a, 64, 0]]);
  });
});
