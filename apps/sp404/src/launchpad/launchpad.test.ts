import { describe, expect, it, vi } from "vitest";
import type { LaunchpadEvent } from "@synth-editors/launchpad";
import type { Bus } from "../core/fxTypes";
import { storePresetAt, storeSceneAt } from "../fx/fxLibrary";
import { choose, emptyFxState, type FxState } from "../fx/fxState";
import { launchpadHandler, NO_LOCAL, type LpFx, type LpLocal } from "./lpControl";
import { buttonTarget, chooserEffect, chooserPad, LP, padTarget, presetPad, scenePad } from "./lpMap";
import { changedLeds, hexRgb, launchpadLeds, OFF } from "./lpView";

describe("lpMap", () => {
  it("puts bus N's presets down column N (preset 1 at the top) and the scenes down columns 7 and 8", () => {
    expect(presetPad(1, 0)).toBe(81);
    expect(presetPad(5, 7)).toBe(15);
    expect(padTarget(81)).toEqual({ kind: "preset", bus: 1, slot: 0 });
    expect(padTarget(13)).toEqual({ kind: "preset", bus: 3, slot: 7 });
    expect(scenePad(0)).toBe(87);
    expect(scenePad(8)).toBe(88);
    expect(scenePad(15)).toBe(18);
    expect(padTarget(17)).toEqual({ kind: "scene", slot: 7 });
    expect(padTarget(88)).toEqual({ kind: "scene", slot: 8 });
    expect(padTarget(86)).toBeUndefined(); // column 6
    expect(padTarget(91)).toBeUndefined();
  });

  it("names the round buttons: buses on top, locks below, the modifiers", () => {
    expect(buttonTarget(91)).toEqual({ kind: "bus", bus: 1 });
    expect(buttonTarget(95)).toEqual({ kind: "bus", bus: 5 });
    expect(buttonTarget(3)).toEqual({ kind: "lock", bus: 3 });
    expect(buttonTarget(LP.shift)).toEqual({ kind: "modifier", name: "shift" });
    expect(buttonTarget(96)).toBeUndefined();
    expect(buttonTarget(8)).toBeUndefined();
  });

  it("lays the chooser out as the screen's: Filter + Drive top left", () => {
    expect(chooserEffect(chooserPad(0, 0))).toBe(1);
    expect(chooserEffect(11)).not.toBe(1);
  });
});

function fakeFx(state: FxState, over: Partial<LpFx["play"]> = {}) {
  const fx = {
    state,
    toggle: vi.fn(), hold: vi.fn(), chooseEffect: vi.fn(),
    play: {
      mode: "play", audition: false, locks: new Set<Bus>(), morphs: {},
      setMode: vi.fn(), pressPreset: vi.fn(), pressScene: vi.fn(), pressDefaults: vi.fn(), storeDefaults: vi.fn(),
      pressBus: vi.fn(), toggleMorph: vi.fn(), setMorphAmount: vi.fn(), release: vi.fn(), toggleLock: vi.fn(), ...over,
    },
  } as unknown as LpFx;
  return fx;
}

function run(fx: LpFx) {
  let local: LpLocal = NO_LOCAL;
  const cycle = vi.fn();
  const handle = launchpadHandler({ fx: () => fx, cycleBrightness: cycle, onLocal: (l) => void (local = l) });
  const send = (...events: LaunchpadEvent[]) => events.forEach(handle);
  return { send, cycle, local: () => local };
}

const down = (cc: number): LaunchpadEvent => ({ type: "button", cc, value: 127 });
const up = (cc: number): LaunchpadEvent => ({ type: "button", cc, value: 0 });
const hit = (note: number, velocity = 100): LaunchpadEvent => ({ type: "pad", note, velocity });

const withDrive = () => choose(emptyFxState(), 1, 1); // Filter + Drive on bus 1

describe("lpControl", () => {
  it("presses presets and scenes as on screen; Shift previews; letting go releases", () => {
    const fx = fakeFx(withDrive());
    const { send } = run(fx);
    send(hit(presetPad(1, 2)));
    expect(fx.play.pressPreset).toHaveBeenCalledWith({ bus: 1, slot: 2 }, false);
    send(down(LP.shift), hit(scenePad(9)));
    expect(fx.play.pressScene).toHaveBeenCalledWith(9, true);
    send(hit(scenePad(9), 0));
    expect(fx.play.release).toHaveBeenCalled();
  });

  it("toggles a bus with an effect, and does the modifier's job with one held", () => {
    const fx = fakeFx(withDrive());
    const { send } = run(fx);
    send(down(92)); // bus 2 has no effect
    expect(fx.toggle).not.toHaveBeenCalled();
    send(down(91));
    expect(fx.toggle).toHaveBeenCalledWith(1);
    send(down(LP.quantise), down(91), up(LP.quantise));
    expect(fx.play.toggleMorph).toHaveBeenCalledWith(1);
    send(down(LP.click), down(91), up(LP.click));
    expect(fx.play.storeDefaults).toHaveBeenCalledWith(1);
    send(down(LP.undo), down(91), up(LP.undo));
    expect(fx.play.pressDefaults).toHaveBeenCalledWith(1);
    send(down(3));
    expect(fx.play.toggleLock).toHaveBeenCalledWith(3);
  });

  it("grabs a bus while Shift + its button are held, then puts ON/OFF back", () => {
    const state = withDrive();
    const fx = fakeFx({ ...state, buses: { ...state.buses, 1: { ...state.buses[1], on: false } } });
    const r = run(fx);
    r.send(down(LP.shift), down(91));
    expect(fx.hold).toHaveBeenLastCalledWith(1, true);
    expect(r.local().grabbed.has(1)).toBe(true);
    r.send(up(91));
    expect(fx.hold).toHaveBeenLastCalledWith(1, false);
  });

  it("holding Delete is DEL mode; with it, a bus button clears the bus", () => {
    const fx = fakeFx(withDrive());
    const { send } = run(fx);
    send(down(LP.delete));
    expect(fx.play.setMode).toHaveBeenCalledWith("delete");
    send(down(91));
    expect(fx.play.pressBus).toHaveBeenCalledWith(1);
    (fx.play as { mode: string }).mode = "delete";
    send(up(LP.delete));
    expect(fx.play.setMode).toHaveBeenCalledTimes(2); // off again
  });

  it("with morph on, the target's pressure sets the amount; pressing the target again keeps the blend", () => {
    const state = storePresetAt(withDrive(), { bus: 1, slot: 0 }, new Set());
    const fx = fakeFx(state, { morphs: { 1: { slot: 0, source: [], amount: 0.2 } } });
    const { send } = run(fx);
    send(hit(presetPad(1, 0)));
    expect(fx.play.pressPreset).not.toHaveBeenCalled();
    send({ type: "pressure", note: presetPad(1, 0), value: 127 });
    expect(fx.play.setMorphAmount).toHaveBeenCalledWith(1, 1);
    send({ type: "channelPressure", value: 0 });
    expect(fx.play.setMorphAmount).toHaveBeenLastCalledWith(1, 0);
    send({ type: "pressure", note: presetPad(1, 1), value: 50 }); // not the target
    expect(fx.play.setMorphAmount).toHaveBeenCalledTimes(2);
  });

  it("Device + a bus button opens the chooser; an effect pressed twice loads; one the bus can't load does nothing", () => {
    const fx = fakeFx(emptyFxState());
    const r = run(fx);
    r.send(down(LP.device), down(93), up(LP.device));
    expect(r.local().chooser).toEqual({ bus: 3 });
    r.send(hit(chooserPad(0, 0)));
    expect(r.local().chooser).toEqual({ bus: 3, pending: 1 });
    expect(fx.chooseEffect).not.toHaveBeenCalled();
    r.send(hit(chooserPad(0, 0), 0), hit(chooserPad(0, 0)));
    expect(fx.chooseEffect).toHaveBeenCalledWith(3, 1);
    expect(r.local().chooser).toBeUndefined();
    expect(fx.play.release).not.toHaveBeenCalled();
  });

  it("Device again closes the chooser; User cycles the brightness", () => {
    const r = run(fakeFx(emptyFxState()));
    r.send(down(LP.device), down(91), up(LP.device), down(LP.device));
    expect(r.local().chooser).toBeUndefined();
    r.send(down(LP.user));
    expect(r.cycle).toHaveBeenCalledTimes(1);
  });
});

describe("lpView", () => {
  const view = (state: FxState, over: Partial<LpFx["play"]> = {}, local: LpLocal = NO_LOCAL) =>
    launchpadLeds(fakeFx(state, over), local, "normal");

  it("lights stored presets in the bus colour, the current one full, empty ones off", () => {
    const state = storePresetAt(storePresetAt(withDrive(), { bus: 1, slot: 0 }, new Set()), { bus: 1, slot: 1 }, new Set());
    const leds = view({ ...state, buses: { ...state.buses, 1: { ...state.buses[1], values: [1, 2, 3, 4, 5, 6] } } });
    const pink = hexRgb("#ff5f9e");
    expect(leds.get(presetPad(1, 0))).toEqual(pink.map((v) => Math.round(v * 0.3)));
    expect(leds.get(presetPad(1, 2))).toEqual(OFF);
    const now = view(state); // values match both: the first is "on"
    expect(now.get(presetPad(1, 0))).toEqual(pink);
  });

  it("shows scenes white and buses on or off; DEL turns stored pads red", () => {
    const state = storeSceneAt(withDrive(), 3);
    const leds = view(state, { mode: "delete" });
    expect(leds.get(scenePad(3))![0]).toBeGreaterThan(0);
    expect(leds.get(scenePad(3))![1]).toBe(0); // red
    expect(leds.get(91)).toEqual(hexRgb("#ff5f9e")); // bus 1 on
    expect(Math.max(...leds.get(92)!)).toBeLessThanOrEqual(3); // no effect: dimmer than idle
  });

  it("in the chooser, shows what the bus can load and only that bus's button", () => {
    const leds = view(emptyFxState(), {}, { ...NO_LOCAL, chooser: { bus: 5, pending: 46 } });
    expect([...leds].filter(([led, c]) => led < 90 && led % 10 !== 0 && c.some((x) => x > 0)).length)
      .toBeLessThan(47);
    expect(leds.get(95)![0] + leds.get(95)![1] + leds.get(95)![2]).toBeGreaterThan(0);
    expect(leds.get(91)).toEqual(OFF);
  });

  it("sends only the LEDs that changed", () => {
    const sent = new Map([[11, [1, 2, 3] as const]]);
    const next = new Map([[11, [1, 2, 3] as const], [12, [0, 0, 0] as const], [13, [5, 0, 0] as const]]);
    expect(changedLeds(sent, next)).toEqual([[13, [5, 0, 0]]]);
  });
});
