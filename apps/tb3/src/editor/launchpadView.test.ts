import { describe, expect, it } from "vitest";
import { LP_BUTTON, changedLeds, launchpadLeds } from "./launchpadView";
import type { LaunchpadView } from "./launchpadView";

const filled = Array.from({ length: 64 }, (_, i) => i < 3 || i === 8); // slots 1–3 and 9
const view = (v: Partial<LaunchpadView> = {}): LaunchpadView => ({
  filled, active: 0, mode: null, target: null, held: new Set(), syncing: false, profile: "normal", ...v,
});

describe("launchpadLeds", () => {
  it("lights filled slots in their row's colour, the active one green at full, and leaves empty slots dark", () => {
    const leds = launchpadLeds(view());
    expect(leds.get(81)).toEqual([6, 63, 14]); // slot 1, active
    expect(leds.get(82)).toEqual([0, 12, 19]); // slot 2, row 1 cyan, idle (0.3)
    expect(leds.get(71)).toEqual([2, 5, 19]); // slot 9, row 2 blue
    expect(leds.get(84)).toEqual([0, 0, 0]); // slot 4, empty
    expect(leds.get(11)).toEqual([0, 0, 0]); // slot 57, empty
    expect(leds.size).toBe(64 + 5);
  });

  it("colours filled slots by mode and marks the morph target", () => {
    expect(launchpadLeds(view({ mode: "delete" })).get(82)).toEqual([19, 0, 0]);
    expect(launchpadLeds(view({ mode: "grab" })).get(82)).toEqual([19, 19, 19]);
    expect(launchpadLeds(view({ target: 2 })).get(83)).toEqual([63, 22, 0]);
  });

  it("brightens held pads, empty ones grey", () => {
    const leds = launchpadLeds(view({ held: new Set([1, 5]) }));
    expect(leds.get(82)).toEqual([0, 35, 55]); // 0.88
    expect(leds.get(86)).toEqual([18, 18, 18]); // 0.45 grey
  });

  it("lights the side buttons for their modes and while syncing", () => {
    const idle = launchpadLeds(view());
    const on = launchpadLeds(view({ mode: "delete", syncing: true }));
    expect(idle.get(LP_BUTTON.delete)).toEqual([19, 0, 0]);
    expect(on.get(LP_BUTTON.delete)).toEqual([63, 0, 0]);
    expect(on.get(LP_BUTTON.sync)).toEqual([6, 63, 14]);
  });

  it("follows the brightness profile", () => {
    expect(launchpadLeds(view({ profile: "very dim" })).get(82)).toEqual([0, 3, 5]);
  });
});

describe("changedLeds", () => {
  it("returns only what differs, treating unsent LEDs as off", () => {
    const sent = new Map([[81, [1, 2, 3] as const]]);
    const next = new Map([
      [81, [1, 2, 3] as const],
      [82, [0, 0, 0] as const],
      [83, [4, 5, 6] as const],
    ]);
    expect(changedLeds(sent, next)).toEqual([[83, [4, 5, 6]]]);
  });
});
