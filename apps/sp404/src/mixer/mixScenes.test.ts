import { describe, expect, it } from "vitest";
import type { PadBlock } from "../core/serialMessages";
import { emptyMixMemory, setButtons, toggleMute, viewPad, type MixMemory } from "./mixerState";
import {
  currentScene, deleteAt, emptyMixScenes, readMixScenes, recallScene, storeAt, toggleSafe,
} from "./mixScenes";

const padBlock = (pad: number, level: number, pan = 64): PadBlock => ({
  pad, empty: false, name: `PAD ${pad}`,
  mix: { level, pan, routing: 1, muteGroup: 0, attack: 0, hold: 100, release: 0 }, seconds: 0.5,
});

const desk = (blocks: PadBlock[], memory: MixMemory) => blocks.map((b) => viewPad(b, memory));

describe("mix scenes", () => {
  it("stores the loaded pads' values and MUTE buttons, and knows when the desk matches", () => {
    const blocks = [padBlock(0, 100), padBlock(1, 80)];
    const muted = setButtons(blocks, emptyMixMemory, toggleMute(emptyMixMemory, 1));
    const s = storeAt(emptyMixScenes(), 2, desk(muted.blocks, muted.memory));
    expect(s.scenes[2]).toEqual({
      0: { mix: blocks[0]!.mix, muted: false },
      1: { mix: blocks[1]!.mix, muted: true }, // the level it goes back to
    });
    expect(currentScene(s, desk(muted.blocks, muted.memory))).toBe(2);
    expect(currentScene(s, desk(blocks, emptyMixMemory))).toBeUndefined(); // pad 1's MUTE is off
    expect(deleteAt(s, 2).scenes[2]).toBeNull();
  });

  it("recalls values and MUTE onto loaded pads, leaving others alone and skipping gone ones", () => {
    const stored = storeAt(emptyMixScenes(), 0, desk([padBlock(0, 50, 30), padBlock(3, 20)], emptyMixMemory)).scenes[0]!;
    const now = [padBlock(0, 100), padBlock(1, 90)];
    const e = recallScene(now, emptyMixMemory, stored, new Set());
    expect(e.changes).toEqual([{ pad: 0, field: "level", value: 50 }, { pad: 0, field: "pan", value: 30 }]);
    expect(e.blocks.map((b) => b.mix.level)).toEqual([50, 90]);
  });

  it("RECALL SAFE leaves its types alone", () => {
    const stored = storeAt(emptyMixScenes(), 0, desk([padBlock(0, 50, 30)], emptyMixMemory)).scenes[0]!;
    const e = recallScene([padBlock(0, 100)], emptyMixMemory, stored, new Set(["level"]));
    expect(e.changes).toEqual([{ pad: 0, field: "pan", value: 30 }]);
  });

  it("a muted pad in the scene goes silent and keeps the scene's level to go back to", () => {
    const blocks = [padBlock(0, 70)];
    const m = setButtons(blocks, emptyMixMemory, toggleMute(emptyMixMemory, 0));
    const stored = storeAt(emptyMixScenes(), 0, desk(m.blocks, m.memory)).scenes[0]!;
    const e = recallScene([padBlock(0, 100)], emptyMixMemory, stored, new Set());
    expect(e.blocks[0]!.mix.level).toBe(0);
    expect(e.memory).toMatchObject({ mutes: [0], levels: { 0: 70 } });
    const safe = recallScene([padBlock(0, 100)], emptyMixMemory, stored, new Set(["mute"]));
    expect(safe.blocks[0]!.mix.level).toBe(70);
    expect(safe.memory.mutes).toEqual([]);
  });

  it("reads back what was stored, dropping anything malformed", () => {
    const s = toggleSafe(storeAt(emptyMixScenes(), 1, desk([padBlock(0, 1)], emptyMixMemory)), "ahr");
    expect(readMixScenes(JSON.parse(JSON.stringify(s)))).toEqual(s);
    expect(readMixScenes({ scenes: "x", safe: ["level"] })).toEqual(emptyMixScenes());
    expect(readMixScenes({ scenes: [], safe: ["level", "nope"] }).safe).toEqual(["level"]);
  });
});
