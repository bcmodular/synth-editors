import { describe, expect, it } from "vitest";
import type { PadBlock } from "../core/serialMessages";
import { editPad, setBankVolume, setField, toggleBankMute, toggleMute, viewBank, viewPad } from "./mixerState";

const block: PadBlock = {
  pad: 5, empty: false, name: "SNARE",
  mix: { level: 100, pan: 64, routing: 1, muteGroup: 0, attack: 0, hold: 100, release: 0 },
};

describe("mixer state", () => {
  it("shows a pad as the device has it when not muted", () => {
    expect(viewPad(block, {})).toMatchObject({ pad: 5, name: "SNARE", muted: false, mix: { level: 100 } });
  });

  it("mutes by sending level 0 and remembering the level", () => {
    const e = editPad(block, {}, toggleMute);
    expect(e.changes).toEqual([{ pad: 5, field: "level", value: 0 }]);
    expect(e.block.mix.level).toBe(0);
    expect(e.memory).toEqual({ 5: 100 });
    expect(viewPad(e.block, e.memory)).toMatchObject({ muted: true, mix: { level: 100 } });
  });

  it("unmutes by sending the remembered level", () => {
    const muted = editPad(block, {}, toggleMute);
    const e = editPad(muted.block, muted.memory, toggleMute);
    expect(e.changes).toEqual([{ pad: 5, field: "level", value: 100 }]);
    expect(e.memory).toEqual({});
  });

  it("moves a muted pad's remembered level without sending it", () => {
    const muted = editPad(block, {}, toggleMute);
    const e = editPad(muted.block, muted.memory, setField("level", 70));
    expect(e.changes).toEqual([]);
    expect(e.memory).toEqual({ 5: 70 });
  });

  it("sends other values of a muted pad as usual", () => {
    const muted = editPad(block, {}, toggleMute);
    expect(editPad(muted.block, muted.memory, setField("pan", 30)).changes).toEqual([{ pad: 5, field: "pan", value: 30 }]);
  });
});

describe("bank mute", () => {
  it("mutes by sending volume 0 and remembering the volume", () => {
    const e = toggleBankMute({}, 2, 100);
    expect(e).toEqual({ memory: { 2: 100 }, send: 0 });
    expect(viewBank(0, e.memory, 2)).toEqual({ volume: 100, muted: true });
  });

  it("unmutes by sending the remembered volume", () => {
    expect(toggleBankMute({ 2: 100 }, 2, 0)).toEqual({ memory: {}, send: 100 });
  });

  it("moves a muted bank's remembered volume without sending it", () => {
    expect(setBankVolume({ 2: 100 }, 2, 80)).toEqual({ memory: { 2: 80 } });
    expect(setBankVolume({}, 2, 80)).toEqual({ memory: {}, send: 80 });
  });

  it("shows an unmuted bank as the device has it", () => {
    expect(viewBank(90, {}, 1)).toEqual({ volume: 90, muted: false });
  });
});
