import { describe, expect, it } from "vitest";
import { deviceMix, padChanges, recallMixScene, storeMixScene, toggleMute, type MixerPad, type PadMix } from "./mixer";

const mix = (level: number, extra: Partial<PadMix> = {}): PadMix => ({
  level, pan: 64, routing: 0, muteGroup: 0, attack: 0, hold: 100, release: 0, ...extra,
});
const pad = (n: number, level: number, extra: Partial<PadMix> = {}): MixerPad => ({
  pad: n, name: `Pad ${n}`, mix: mix(level, extra), muted: false,
});

describe("app-side mute", () => {
  it("sends level 0 while muted and restores the level after", () => {
    const muted = toggleMute(pad(0, 100));
    expect(deviceMix(muted).level).toBe(0);
    expect(muted.mix.level).toBe(100);
    expect(padChanges(pad(0, 100), muted)).toEqual([{ pad: 0, field: "level", value: 0 }]);
    expect(padChanges(muted, toggleMute(muted))).toEqual([{ pad: 0, field: "level", value: 100 }]);
  });
});

describe("mix scenes", () => {
  const loaded = [pad(0, 100), pad(1, 90), pad(2, 80)];
  const scene = storeMixScene([pad(0, 50, { pan: 30 }), pad(1, 90, { routing: 2 }), pad(5, 10)]);

  it("sets the loaded scene pads, leaves the others and skips pads no longer loaded", () => {
    const { pads, changes } = recallMixScene(loaded, scene);
    expect(pads.map((p) => p.mix.level)).toEqual([50, 90, 80]);
    expect(changes).toEqual([
      { pad: 0, field: "level", value: 50 },
      { pad: 0, field: "pan", value: 30 },
      { pad: 1, field: "routing", value: 2 },
    ]);
  });

  it("leaves recall-safe value types alone", () => {
    const { changes } = recallMixScene(loaded, scene, new Set(["level", "routing"]));
    expect(changes).toEqual([{ pad: 0, field: "pan", value: 30 }]);
  });

  it("recalls mute unless mute is safe", () => {
    const mutedScene = storeMixScene([toggleMute(pad(2, 80))]);
    expect(recallMixScene(loaded, mutedScene).changes).toEqual([{ pad: 2, field: "level", value: 0 }]);
    expect(recallMixScene(loaded, mutedScene, new Set(["mute"])).changes).toEqual([]);
  });

  it("stores a copy", () => {
    const pads = [pad(0, 1)];
    const stored = storeMixScene(pads);
    pads[0]!.mix.level = 99;
    expect(stored[0]?.mix.level).toBe(1);
  });
});
