import { describe, expect, it } from "vitest";
import type { PadBlock } from "../core/serialMessages";
import {
  editPad, emptyMixMemory, readMixMemory, setBankButtons, setBankVolume, setButtons, setField, toggleMute, toggleSolo,
  viewBank, viewPad, type MixMemory,
} from "./mixerState";

const padBlock = (pad: number, level: number): PadBlock => ({
  pad, empty: false, name: `PAD ${pad}`,
  mix: { level, pan: 64, routing: 1, muteGroup: 0, attack: 0, hold: 100, release: 0 }, seconds: 0.5,
});
const block = padBlock(5, 100);

const press = (blocks: PadBlock[], memory: MixMemory, change: (m: MixMemory) => MixMemory) =>
  setButtons(blocks, memory, change(memory));

describe("pad MUTE", () => {
  it("shows a pad as the device has it when nothing is pressed", () => {
    expect(viewPad(block, emptyMixMemory)).toMatchObject({ pad: 5, muted: false, mute: false, solo: false, mix: { level: 100 } });
  });

  it("mutes by sending level 0 and remembering the level", () => {
    const e = press([block], emptyMixMemory, (m) => toggleMute(m, 5));
    expect(e.changes).toEqual([{ pad: 5, field: "level", value: 0 }]);
    expect(e.blocks[0]?.mix.level).toBe(0);
    expect(e.memory).toEqual({ levels: { 5: 100 }, mutes: [5], solos: [] });
    expect(viewPad(e.blocks[0]!, e.memory)).toMatchObject({ muted: true, mute: true, mix: { level: 100 } });
  });

  it("unmutes by sending the remembered level", () => {
    const muted = press([block], emptyMixMemory, (m) => toggleMute(m, 5));
    const e = press(muted.blocks, muted.memory, (m) => toggleMute(m, 5));
    expect(e.changes).toEqual([{ pad: 5, field: "level", value: 100 }]);
    expect(e.memory).toEqual(emptyMixMemory);
  });

  it("moves a silent pad's remembered level without sending it, and sends its other values", () => {
    const muted = press([block], emptyMixMemory, (m) => toggleMute(m, 5));
    const e = editPad(muted.blocks[0]!, muted.memory, setField("level", 70));
    expect(e.changes).toEqual([]);
    expect(e.memory.levels).toEqual({ 5: 70 });
    expect(editPad(muted.blocks[0]!, muted.memory, setField("pan", 30)).changes).toEqual([{ pad: 5, field: "pan", value: 30 }]);
  });
});

describe("pad SOLO", () => {
  const blocks = [padBlock(0, 100), padBlock(1, 90), padBlock(17, 80)];

  it("silences every pad not soloed, across banks", () => {
    const e = press(blocks, emptyMixMemory, (m) => toggleSolo(m, 0));
    expect(e.changes).toEqual([{ pad: 1, field: "level", value: 0 }, { pad: 17, field: "level", value: 0 }]);
    expect(e.memory.levels).toEqual({ 1: 90, 17: 80 });
  });

  it("adds a second soloed pad back in", () => {
    const one = press(blocks, emptyMixMemory, (m) => toggleSolo(m, 0));
    const two = press(one.blocks, one.memory, (m) => toggleSolo(m, 17));
    expect(two.changes).toEqual([{ pad: 17, field: "level", value: 80 }]);
  });

  it("restores everything when the last solo is released, except muted pads", () => {
    const muted = press(blocks, emptyMixMemory, (m) => toggleMute(m, 1));
    const soloed = press(muted.blocks, muted.memory, (m) => toggleSolo(m, 0));
    const e = press(soloed.blocks, soloed.memory, (m) => toggleSolo(m, 0));
    expect(e.changes).toEqual([{ pad: 17, field: "level", value: 80 }]);
    expect(e.memory.levels).toEqual({ 1: 90 });
  });

  it("keeps a soloed pad silent while it's muted", () => {
    const muted = press(blocks, emptyMixMemory, (m) => toggleMute(m, 0));
    const e = press(muted.blocks, muted.memory, (m) => toggleSolo(m, 0));
    expect(e.changes.map((c) => c.pad)).toEqual([1, 17]);
    expect(viewPad(e.blocks[0]!, e.memory)).toMatchObject({ muted: true, mute: true, solo: true });
  });
});

describe("bank MUTE and SOLO", () => {
  const volumes = [100, 90, 80];

  it("mutes by sending volume 0 and remembering the volume", () => {
    const e = setBankButtons(volumes, emptyMixMemory, toggleMute(emptyMixMemory, 2));
    expect(e.sends).toEqual([{ bank: 2, volume: 0 }]);
    expect(viewBank(0, e.memory, 2)).toEqual({ volume: 80, silent: true, mute: true, solo: false });
  });

  it("solo silences the other banks, and releasing it restores them", () => {
    const soloed = setBankButtons(volumes, emptyMixMemory, toggleSolo(emptyMixMemory, 1));
    expect(soloed.sends).toEqual([{ bank: 0, volume: 0 }, { bank: 2, volume: 0 }]);
    const e = setBankButtons([0, 90, 0], soloed.memory, toggleSolo(soloed.memory, 1));
    expect(e.sends).toEqual([{ bank: 0, volume: 100 }, { bank: 2, volume: 80 }]);
    expect(e.memory).toEqual(emptyMixMemory);
  });

  it("moves a silent bank's remembered volume without sending it", () => {
    const muted = setBankButtons(volumes, emptyMixMemory, toggleMute(emptyMixMemory, 2));
    expect(setBankVolume(muted.memory, 2, 60)).toEqual({ memory: { ...muted.memory, levels: { 2: 60 } }, sends: [] });
    expect(setBankVolume(emptyMixMemory, 2, 60).sends).toEqual([{ bank: 2, volume: 60 }]);
  });
});

describe("saved memory", () => {
  it("reads mute memory saved before SOLO as muted pads", () => {
    expect(readMixMemory({ 3: 90 })).toEqual({ levels: { 3: 90 }, mutes: [3], solos: [] });
    expect(readMixMemory({ levels: { 3: 90 }, mutes: [], solos: [3] })).toEqual({ levels: { 3: 90 }, mutes: [], solos: [3] });
    expect(readMixMemory(null)).toEqual(emptyMixMemory);
  });
});
