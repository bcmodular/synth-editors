// What the Launchpad Pro shows for the SP-404 FX (docs/sp404-design.md › Controllers › Launchpad Pro), as LED number →
// colour, from the FX state and what the Launchpad holds. Pure, so the hook only sends what changed. Colours follow
// the screen: each bus's colour on its preset column and bus button, white scenes, red for delete and lock, lilac for
// morph; the chooser shows the screen chooser's group colours.

import { BRIGHTNESS_PROFILES, scaleRgb } from "@synth-editors/launchpad";
import type { Brightness, ProfileName, Rgb } from "@synth-editors/launchpad";
import { canLoad } from "../core/fx";
import { BUSES, type Bus } from "../core/fxTypes";
import { currentPreset, currentScene, slotsOn } from "../fx/fxLibrary";
import { FX_GROUPS } from "../fx/fxGroups";
import { BUS_ACCENT } from "../fx/FxModule";
import type { LpFx, LpLocal } from "./lpControl";
import {
  busButton, chooserPad, LP, lockButton, MODIFIERS, presetPad, PRESETS, SCENES, scenePad, type Modifier,
} from "./lpMap";

export const OFF: Rgb = [0, 0, 0];
const WHITE: Rgb = [63, 63, 63];
const RED: Rgb = [63, 0, 0];
const GREY: Rgb = [40, 40, 40];

// A screen colour (#rrggbb) on the Launchpad's 0–63 scale.
export function hexRgb(hex: string): Rgb {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => Math.round((v / 255) * 63)) as unknown as Rgb;
}

const MORPH = hexRgb("#d8a2ff");
const busRgb = (bus: Bus) => hexRgb(BUS_ACCENT[bus]);

const MODIFIER_RGB: Record<Modifier, Rgb> = {
  quantise: MORPH, delete: RED, undo: [63, 0, 63], click: [0, 63, 0], shift: WHITE, device: [13, 38, 63],
  user: [50, 50, 63],
};

// A bus button for a bus that's off, dimmer than idle (as in TouchOSC).
const BUS_OFF: Record<ProfileName, number> = { "very dim": 0.01, night: 0.02, normal: 0.05, day: 0.08 };

export type LpFxView = Pick<LpFx, "state" | "play">;

interface View {
  fx: LpFxView;
  local: LpLocal;
  b: Brightness;
  profile: ProfileName;
}

type Leds = Map<number, Rgb>;

const rounded = (c: Rgb): Rgb => [Math.round(c[0]), Math.round(c[1]), Math.round(c[2])];

// ---- presets and scenes

function presetHue(v: View, bus: Bus): Rgb {
  const { play } = v.fx;
  if (play.morphs[bus]) return MORPH;
  if (play.mode === "delete" && !play.locks.has(bus)) return RED;
  return busRgb(bus);
}

function presetColour(v: View, bus: Bus, slot: number): Rgb {
  const note = presetPad(bus, slot);
  const down = v.local.pads.has(note);
  if (!slotsOn(v.fx.state, bus)[slot]) return down && v.fx.state.buses[bus].fxId ? scaleRgb(GREY, v.b.emptyPress) : OFF;
  const morph = v.fx.play.morphs[bus];
  const lit = morph ? morph.slot === slot : currentPreset(v.fx.state, bus) === slot;
  const level = lit ? v.b.on : down ? v.b.press : v.b.idle;
  return scaleRgb(presetHue(v, bus), level);
}

function sceneColour(v: View, slot: number): Rgb {
  const down = v.local.pads.has(scenePad(slot));
  if (!v.fx.state.scenes[slot]) return down ? scaleRgb(GREY, v.b.emptyPress) : OFF;
  const hue = v.fx.play.mode === "delete" ? RED : WHITE;
  const lit = currentScene(v.fx.state) === slot;
  return scaleRgb(hue, lit ? v.b.on : down ? v.b.press : v.b.idle);
}

// ---- round buttons

function busColour(v: View, bus: Bus): Rgb {
  const b = v.fx.state.buses[bus];
  const on = b.fxId !== 0 && (b.on || v.local.grabbed.has(bus));
  return scaleRgb(busRgb(bus), on ? v.b.on : BUS_OFF[v.profile]);
}

function modifierOn(v: View, m: Modifier): boolean {
  if (v.local.held.has(m)) return true;
  if (m === "delete") return v.fx.play.mode === "delete";
  if (m === "shift") return v.fx.play.audition;
  return false;
}

function buttons(v: View, leds: Leds) {
  for (const bus of BUSES) {
    leds.set(busButton(bus), busColour(v, bus));
    leds.set(lockButton(bus), scaleRgb(RED, v.fx.play.locks.has(bus) ? v.b.on : v.b.idle));
  }
  for (const m of MODIFIERS) leds.set(LP[m], scaleRgb(MODIFIER_RGB[m], modifierOn(v, m) ? v.b.on : v.b.idle));
}

// ---- the chooser: every effect the bus can load in its group's colour, the current one bright, the marked one white

function chooser(v: View, leds: Leds) {
  const c = v.local.chooser!;
  const current = v.fx.state.buses[c.bus].fxId;
  FX_GROUPS.forEach((g, row) => g.effects.forEach((fx, cell) => {
    const hue = hexRgb(g.colour);
    const colour = !canLoad(fx, c.bus) ? OFF
      : c.pending === fx.id ? WHITE
      : scaleRgb(hue, fx.id === current ? v.b.on : v.b.idle);
    leds.set(chooserPad(row, cell), colour);
  }));
  for (const bus of BUSES) leds.set(busButton(bus), bus === c.bus ? scaleRgb(busRgb(bus), v.b.on) : OFF);
  leds.set(LP.device, scaleRgb(MODIFIER_RGB.device, v.b.on));
}

// Every grid LED (off unless set), then the round buttons.
function grid(): Leds {
  const leds: Leds = new Map();
  for (let r = 1; r <= 8; r++) for (let c = 1; c <= 8; c++) leds.set(r * 10 + c, OFF);
  return leds;
}

export function launchpadLeds(fx: LpFxView, local: LpLocal, profile: ProfileName): Map<number, Rgb> {
  const v: View = { fx, local, b: BRIGHTNESS_PROFILES[profile], profile };
  const leds = grid();
  buttons(v, leds);
  if (local.chooser) chooser(v, leds);
  else {
    for (const bus of BUSES) for (let s = 0; s < PRESETS; s++) leds.set(presetPad(bus, s), presetColour(v, bus, s));
    for (let s = 0; s < SCENES; s++) leds.set(scenePad(s), sceneColour(v, s));
  }
  return new Map([...leds].map(([led, c]) => [led, rounded(c)]));
}

const same = (a: Rgb | undefined, b: Rgb) => a !== undefined && a.every((x, i) => x === b[i]);

// The LEDs in `next` that differ from what was last sent (an LED never sent counts as off).
export function changedLeds(sent: ReadonlyMap<number, Rgb>, next: ReadonlyMap<number, Rgb>): [number, Rgb][] {
  return [...next].filter(([led, c]) => !same(sent.get(led) ?? OFF, c));
}
