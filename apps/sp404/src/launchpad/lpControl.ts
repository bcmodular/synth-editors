// Launchpad Pro input → the FX (docs/sp404-design.md › Controllers › Launchpad Pro), as in the TouchOSC version. A
// preset or scene pad presses it as on screen (held with Shift: a preview until let go; with Delete held: deleted);
// with morph on, a stored preset pad picks the target and its pressure sets the amount. A bus button switches the
// bus on and off, or with a modifier held: Device opens the chooser, Delete clears the bus, Quantise toggles morph,
// Click stores defaults, Undo recalls them, Shift grabs the bus while held. A bottom button toggles the bus's LOCK.

import type { LaunchpadEvent } from "@synth-editors/launchpad";
import { canLoad, effectById } from "../core/fx";
import type { Bus, FxId } from "../core/fxTypes";
import { slotsOn } from "../fx/fxLibrary";
import type { Fx } from "../fx/useFx";
import { buttonTarget, chooserEffect, padTarget, type Modifier, type PadTarget } from "./lpMap";

export type LpFx = Pick<Fx, "state" | "play" | "toggle" | "hold" | "chooseEffect">;

export interface Chooser {
  bus: Bus;
  pending?: FxId; // pressed once: a second press loads it
}

// What the Launchpad itself holds, for its lights.
export interface LpLocal {
  held: ReadonlySet<Modifier>;
  pads: ReadonlySet<number>; // grid notes down
  chooser?: Chooser;
  grabbed: ReadonlySet<Bus>;
}

export const NO_LOCAL: LpLocal = { held: new Set(), pads: new Set(), grabbed: new Set() };

export interface LpDeps {
  fx: () => LpFx; // the latest
  cycleBrightness: () => void;
  onLocal: (local: LpLocal) => void;
}

interface Held {
  modifiers: Set<Modifier>;
  pads: Set<number>;
  grabbed: Map<Bus, boolean>; // bus → ON/OFF before the grab
  setDelete: boolean; // Delete put the app in DEL mode
  chooser?: Chooser;
  last?: number; // the last pad pressed, for channel pressure
}

const hasFx = (fx: LpFx, bus: Bus) => fx.state.buses[bus].fxId !== 0;

// ---- grid pads

function pressPad(fx: LpFx, t: PadTarget, shift: boolean) {
  if (t.kind === "scene") return fx.play.pressScene(t.slot, shift);
  if (fx.play.morphs[t.bus]?.slot === t.slot) return; // already the target: keep its blend
  fx.play.pressPreset({ bus: t.bus, slot: t.slot }, shift);
}

// Pressure on the morph target's pad sets the amount.
function pressure(fx: LpFx, note: number | undefined, value: number) {
  const t = note === undefined ? undefined : padTarget(note);
  if (t?.kind !== "preset" || fx.play.morphs[t.bus]?.slot !== t.slot) return;
  if (!slotsOn(fx.state, t.bus)[t.slot]) return;
  fx.play.setMorphAmount(t.bus, value / 127);
}

// The effect on a chooser pad, if the chooser's bus can load it.
function loadable(c: Chooser, note: number): FxId | undefined {
  const def = effectById(chooserEffect(note) ?? 0);
  return def && canLoad(def, c.bus) ? def.id : undefined;
}

// The chooser: a first press marks an effect, a second loads it on the bus and closes the chooser.
function choose(fx: LpFx, h: Held, note: number) {
  const c = h.chooser;
  const id = c && loadable(c, note);
  if (!c || id === undefined) return;
  if (c.pending !== id) return void (h.chooser = { ...c, pending: id });
  fx.chooseEffect(c.bus, id);
  h.chooser = undefined;
}

// ---- bus buttons

type BusPress = (fx: LpFx, h: Held, bus: Bus) => void;

const BUS_WITH: Partial<Record<Modifier, BusPress>> = {
  device: (_fx, h, bus) => void (h.chooser = { bus }),
  delete: (fx, _h, bus) => fx.play.pressBus(bus),
  quantise: (fx, _h, bus) => hasFx(fx, bus) && fx.play.toggleMorph(bus),
  click: (fx, _h, bus) => hasFx(fx, bus) && fx.play.storeDefaults(bus),
  undo: (fx, _h, bus) => hasFx(fx, bus) && fx.play.pressDefaults(bus),
  shift: (fx, h, bus) => {
    if (!hasFx(fx, bus) || h.grabbed.has(bus)) return;
    h.grabbed.set(bus, fx.state.buses[bus].on);
    fx.hold(bus, true);
  },
};

// The modifiers in the order they win when several are held (as TouchOSC checked them).
const BUS_ORDER: Modifier[] = ["device", "delete", "quantise", "click", "undo", "shift"];

function pressBus(fx: LpFx, h: Held, bus: Bus) {
  const mod = BUS_ORDER.find((m) => h.modifiers.has(m));
  if (mod) return BUS_WITH[mod]?.(fx, h, bus);
  if (hasFx(fx, bus)) fx.toggle(bus);
}

function releaseBus(fx: LpFx, h: Held, bus: Bus) {
  const was = h.grabbed.get(bus);
  if (was === undefined) return;
  h.grabbed.delete(bus);
  fx.hold(bus, was);
}

// ---- modifiers

// Delete held is the app's DEL mode, for as long as it's held (unless DEL was already on).
function holdDelete(fx: LpFx, h: Held, down: boolean) {
  const on = fx.play.mode === "delete";
  if (down && !on) {
    fx.play.setMode("delete");
    h.setDelete = true;
  } else if (!down && h.setDelete) {
    if (on) fx.play.setMode("delete");
    h.setDelete = false;
  }
}

function modifier(d: LpDeps, h: Held, name: Modifier, down: boolean) {
  if (down) h.modifiers.add(name);
  else h.modifiers.delete(name);
  if (name === "delete") holdDelete(d.fx(), h, down);
  if (!down) return;
  if (name === "user") d.cycleBrightness();
  if (name === "device" && h.chooser) h.chooser = undefined; // Device again closes the chooser
}

function button(d: LpDeps, h: Held, cc: number, down: boolean) {
  const t = buttonTarget(cc);
  if (!t) return;
  if (t.kind === "modifier") return modifier(d, h, t.name, down);
  const fx = d.fx();
  if (t.kind === "lock") return void (down && fx.play.toggleLock(t.bus));
  if (down) pressBus(fx, h, t.bus);
  else releaseBus(fx, h, t.bus);
}

function pad(d: LpDeps, h: Held, note: number, down: boolean) {
  const fx = d.fx();
  if (!down) {
    h.pads.delete(note);
    if (!h.chooser) fx.play.release();
    return;
  }
  h.pads.add(note);
  h.last = note;
  if (h.chooser) return choose(fx, h, note);
  const t = padTarget(note);
  if (t) pressPad(fx, t, h.modifiers.has("shift") || fx.play.audition);
}

const localOf = (h: Held): LpLocal => ({
  held: new Set(h.modifiers), pads: new Set(h.pads), chooser: h.chooser, grabbed: new Set(h.grabbed.keys()),
});

// A handler for the Launchpad's input; it keeps what's held and the chooser.
export function launchpadHandler(d: LpDeps): (e: LaunchpadEvent) => void {
  const h: Held = { modifiers: new Set(), pads: new Set(), grabbed: new Map(), setDelete: false };
  return (e) => {
    if (e.type === "button") button(d, h, e.cc, e.value > 0);
    else if (e.type === "pad") pad(d, h, e.note, e.velocity > 0);
    else if (e.type === "pressure") pressure(d.fx(), e.note, e.value);
    else pressure(d.fx(), h.last !== undefined && h.pads.has(h.last) ? h.last : undefined, e.value);
    d.onLocal(localOf(h));
  };
}
