// The effect groups as the chooser's 8 rows (and, later, the Launchpad's 8 rows of pads): one colour per group, each
// paired with the nearest colour in the Launchpad Pro's velocity palette so the pads can match the screen. Within a
// row the effects keep the SP-404's order, so every effect has a fixed cell whatever the bus.

import { EFFECTS } from "../core/fx";
import type { FxDef } from "../core/fxTypes";
import { FX_LAYOUT } from "./fxLayout";

export interface FxGroup {
  name: string;
  colour: string; // on screen
  launchpad: number; // Launchpad Pro palette index (velocity) of the matching pad colour
  effects: FxDef[]; // at most 8, in their cells' order
}

const GROUPS: Omit<FxGroup, "effects">[] = [
  { name: "Filter & EQ", colour: "#2fd3ff", launchpad: 37 }, // cyan
  { name: "Drive & character", colour: "#ff4438", launchpad: 5 }, // red
  { name: "Modulation", colour: "#b48cff", launchpad: 49 }, // violet
  { name: "Delay", colour: "#4a7dff", launchpad: 45 }, // blue
  { name: "Reverb", colour: "#3ddc5a", launchpad: 21 }, // green
  { name: "Pitch & harmonic", colour: "#ff5fc8", launchpad: 53 }, // magenta
  { name: "DJ & performance", colour: "#ff8a2a", launchpad: 9 }, // orange
  { name: "Vintage sim", colour: "#f2d03b", launchpad: 13 }, // yellow
];

export const FX_GROUPS: FxGroup[] = GROUPS.map((g) => ({
  ...g,
  effects: EFFECTS.filter((fx) => FX_LAYOUT[fx.id - 1]?.category === g.name),
}));
