// What the Launchpad Pro shows (docs/tb3-phase4-design.md): the 16 slots on its top two rows and the side buttons'
// lights, as LED number → colour. Pure, so the hook (useLaunchpad.ts) only sends what changed.
import { BRIGHTNESS_PROFILES, scaleRgb, slotToPad } from "@synth-editors/launchpad";
import type { Brightness, ProfileName, Rgb } from "@synth-editors/launchpad";
import type { SlotMode } from "./useSession";

// Side buttons (Programmer layout CCs, named as printed on the Launchpad).
export const LP_BUTTON = { morph: 40, delete: 50, sync: 70, grab: 80, brightness: 98 } as const; // Quantise, Delete,
// Click, Shift, User

export const SLOT_COUNT = 16;

const OFF: Rgb = [0, 0, 0];
const GREEN: Rgb = [6, 63, 14];
const RED: Rgb = [63, 0, 0];
const WHITE: Rgb = [63, 63, 63];
const ORANGE: Rgb = [63, 22, 0];
const GREY: Rgb = [40, 40, 40];

const MODE_COLOUR: Record<NonNullable<SlotMode>, Rgb> = { delete: RED, grab: WHITE, target: ORANGE };

export interface LaunchpadView {
  filled: readonly boolean[]; // per slot
  active: number | null;
  mode: SlotMode;
  target: number | null; // the morph target
  held: ReadonlySet<number>; // slots whose pads are down
  syncing: boolean;
  profile: ProfileName;
}

function slotLevel(v: LaunchpadView, i: number, b: Brightness): number {
  const selected = !v.mode && v.active === i ? b.on : b.idle;
  return v.held.has(i) ? Math.max(b.press, selected) : selected;
}

function slotColour(v: LaunchpadView, i: number, b: Brightness): Rgb {
  if (!v.filled[i]) return v.held.has(i) ? scaleRgb(GREY, b.emptyPress) : OFF;
  if (v.target === i) return scaleRgb(ORANGE, b.on);
  return scaleRgb(v.mode ? MODE_COLOUR[v.mode] : GREEN, slotLevel(v, i, b));
}

const SIDE: readonly [number, Rgb, (v: LaunchpadView) => boolean][] = [
  [LP_BUTTON.morph, ORANGE, (v) => v.mode === "target"],
  [LP_BUTTON.delete, RED, (v) => v.mode === "delete"],
  [LP_BUTTON.sync, GREEN, (v) => v.syncing],
  [LP_BUTTON.grab, WHITE, (v) => v.mode === "grab"],
  [LP_BUTTON.brightness, WHITE, () => false],
];

const rounded = (c: Rgb): Rgb => [Math.round(c[0]), Math.round(c[1]), Math.round(c[2])];

export function launchpadLeds(v: LaunchpadView): Map<number, Rgb> {
  const b = BRIGHTNESS_PROFILES[v.profile];
  const leds = new Map<number, Rgb>();
  for (let i = 0; i < SLOT_COUNT; i++) leds.set(slotToPad(i + 1), rounded(slotColour(v, i, b)));
  for (const [cc, colour, lit] of SIDE) leds.set(cc, rounded(scaleRgb(colour, lit(v) ? b.on : b.idle)));
  return leds;
}

const same = (a: Rgb | undefined, b: Rgb) => a !== undefined && a.every((x, i) => x === b[i]);

// The LEDs in `next` that differ from what was last sent (an LED never sent counts as off).
export function changedLeds(sent: ReadonlyMap<number, Rgb>, next: ReadonlyMap<number, Rgb>): [number, Rgb][] {
  return [...next].filter(([led, c]) => !same(sent.get(led) ?? OFF, c));
}
