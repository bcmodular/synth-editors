// MIDI messages for the SP-404 MK2 FX. The SP-404 sends nothing back, so these are built from the app's state.

import { busChannel, cc83For, effectById } from "./fx";
import { CC_FX_ON, CC_FX_SELECT, type Bus } from "./fxTypes";

export type MidiMessage = [status: number, data1: number, data2: number];

// What one bus is doing: its effect (0 = none chosen), ON/OFF and one raw value per parameter.
export interface BusFx {
  fxId: number;
  on: boolean;
  values: readonly number[];
}

const clamp7 = (v: number): number => Math.max(0, Math.min(127, Math.round(v)));

export function controlChange(bus: Bus, cc: number, value: number): MidiMessage {
  return [0xb0 | busChannel(bus), cc, clamp7(value)];
}

export const fxOnMessage = (bus: Bus, on: boolean): MidiMessage => controlChange(bus, CC_FX_ON, on ? 127 : 0);

// The knob message for parameter `index` of the bus's effect.
export function knobMessage(bus: Bus, fxId: number, index: number, value: number): MidiMessage | undefined {
  const p = effectById(fxId)?.params[index];
  return p && controlChange(bus, p.cc, value);
}

function knobMessages(bus: Bus, state: BusFx, changed: (i: number) => boolean): MidiMessage[] {
  const out: MidiMessage[] = [];
  state.values.forEach((v, i) => {
    const message = changed(i) ? knobMessage(bus, state.fxId, i, v) : undefined;
    if (message) out.push(message);
  });
  return out;
}

// Whole block for an effect change: CC 83, then CC 19, then every knob. Empty if the effect can't load here.
export function effectChangeMessages(bus: Bus, state: BusFx): MidiMessage[] {
  const fx = effectById(state.fxId);
  const select = fx ? cc83For(fx, bus) : 0;
  if (select === 0) return [];
  return [controlChange(bus, CC_FX_SELECT, select), fxOnMessage(bus, state.on), ...knobMessages(bus, state, () => true)];
}

const cleared = (prev: BusFx | undefined, next: BusFx) => next.fxId === 0 && Boolean(prev?.fxId);

// The fewest messages that take the device from `prev` to `next` (prev undefined = unknown, send all).
export function busDiffMessages(bus: Bus, prev: BusFx | undefined, next: BusFx): MidiMessage[] {
  if (cleared(prev, next)) return [fxOnMessage(bus, false)]; // a bus with no effect is switched off
  if (!prev || prev.fxId !== next.fxId) return effectChangeMessages(bus, next);
  const on = prev.on === next.on ? [] : [fxOnMessage(bus, next.on)];
  return [...on, ...knobMessages(bus, next, (i) => prev.values[i] !== next.values[i])];
}
