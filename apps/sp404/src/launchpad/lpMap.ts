// The Launchpad Pro Mk1's layout for the SP-404 FX (docs/sp404-design.md › Controllers › Launchpad Pro), as in the
// TouchOSC version (touchosc-controllers/sp404-mk2/lua/root.lua): in Programmer layout, columns 1–5 are the 8 presets
// of buses 1–5 (preset 1 at the top), columns 7–8 the 16 FX scenes (1–8 down column 7, 9–16 down column 8), the top
// buttons 1–5 switch the buses on and off, the bottom buttons 1–5 lock them, and the round buttons are modifiers.
// While the effect chooser is open, the grid is the screen chooser's 8 × 8 (fx/fxGroups.ts).

import { BUSES, type Bus, type FxId } from "../core/fxTypes";
import { FX_GROUPS } from "../fx/fxGroups";

// Round buttons, named as printed on the Launchpad Pro.
export const LP = {
  quantise: 40, // + bus button: morph on / off
  delete: 50, // held: presets and scenes delete; + bus button: clear the bus
  undo: 60, // + bus button: recall defaults (DEF)
  click: 70, // + bus button: store defaults
  shift: 80, // held: presets and scenes preview while held; + bus button: GRAB (on while held)
  device: 97, // + bus button: the effect chooser on the grid
  user: 98, // LED brightness
} as const;

export type Modifier = keyof typeof LP;
export const MODIFIERS = Object.keys(LP) as Modifier[];

export const PRESETS = 8;
export const SCENES = 16;

export const busButton = (bus: Bus): number => 90 + bus; // top row
export const lockButton = (bus: Bus): number => bus; // bottom row

export const presetPad = (bus: Bus, slot: number): number => 81 + (bus - 1) - slot * 10; // slot 0–7
export const scenePad = (slot: number): number => (slot < 8 ? 87 : 88) - (slot % 8) * 10; // slot 0–15

export type PadTarget = { kind: "preset"; bus: Bus; slot: number } | { kind: "scene"; slot: number };

const row = (note: number) => 8 - Math.floor(note / 10); // 0 = top
const col = (note: number) => note % 10; // 1–8
const onGrid = (note: number) => row(note) >= 0 && row(note) < 8 && col(note) >= 1 && col(note) <= 8;

// What a grid pad is in the normal layout (column 6 is unused).
export function padTarget(note: number): PadTarget | undefined {
  if (!onGrid(note)) return undefined;
  const c = col(note);
  if (c <= 5) return { kind: "preset", bus: c as Bus, slot: row(note) };
  if (c >= 7) return { kind: "scene", slot: (c - 7) * 8 + row(note) };
  return undefined;
}

export type ButtonTarget = { kind: "bus"; bus: Bus } | { kind: "lock"; bus: Bus } | { kind: "modifier"; name: Modifier };

const busAt = (n: number): Bus | undefined => BUSES.find((b) => b === n);

// What a round button is.
export function buttonTarget(cc: number): ButtonTarget | undefined {
  const name = MODIFIERS.find((m) => LP[m] === cc);
  if (name) return { kind: "modifier", name };
  const top = busAt(cc - 90);
  if (top) return { kind: "bus", bus: top };
  const bottom = busAt(cc);
  return bottom ? { kind: "lock", bus: bottom } : undefined;
}

// The chooser: one row per effect group, top row first, each effect in its screen cell.
export const chooserPad = (groupRow: number, cell: number): number => (8 - groupRow) * 10 + cell + 1;

export function chooserEffect(note: number): FxId | undefined {
  if (!onGrid(note)) return undefined;
  return FX_GROUPS[row(note)]?.effects[col(note) - 1]?.id;
}
