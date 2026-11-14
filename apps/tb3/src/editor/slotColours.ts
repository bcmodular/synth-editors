// Slot row colours, on screen and on the Launchpad (docs/tb3-phase4-design.md): four colours, repeating every four
// rows, so neighbouring rows always differ. They keep clear of green (the active slot), red (DELETE), white (GRAB),
// orange (the morph target) and amber (unsaved edits). The Launchpad values are tuned by eye on its LEDs, which
// render RGB differently from the screen.
import type { Rgb } from "@synth-editors/launchpad";
import { SLOTS_PER_ROW } from "../core/patchSet";

export interface RowColour {
  screen: string;
  pad: Rgb; // 0–63 per channel
}

export const ROW_COLOURS: readonly RowColour[] = [
  { screen: "#4cc9f0", pad: [0, 40, 63] }, // cyan
  { screen: "#6f8cff", pad: [8, 16, 63] }, // blue
  { screen: "#b483ff", pad: [34, 8, 63] }, // violet
  { screen: "#ff72c4", pad: [63, 10, 40] }, // pink
];

export const rowColour = (slot: number): RowColour =>
  ROW_COLOURS[Math.floor(slot / SLOTS_PER_ROW) % ROW_COLOURS.length]!;
