// The BCR2000's mapping, from the TouchOSC layout's preset (touchosc-controllers/sp404-mk2/SP404-mk2-BCR2000.syx), so
// the user's BCR keeps it (docs/sp404-design.md › Controllers › BCR2000). Bus N is on MIDI channel 5 + N; each bus
// takes two adjacent columns: morph amount on the left top encoder, the six effect parameters in three rows of two
// (slots 1–3 down the left column, 4–6 down the right). Buses 1–4 are one BCR preset, bus 5 the other.

import type { MidiMessage } from "../core/midi";
import type { Bus } from "../core/fxTypes";

// The CC of each parameter slot (slot 1 first): rows 1–3 of the left column, then of the right.
export const PARAM_CCS = [81, 89, 97, 82, 90, 98] as const;
export const SLOTS = PARAM_CCS.length;
export const MORPH_CC = 1;
// FX, SYNC, GRAB, MORPH: in the preset, but the Launchpad and the screen do these now.
export const BUTTON_CCS = [65, 66, 73, 74] as const;

export type BcrPreset = 1 | 2;
export const presetOf = (bus: Bus): BcrPreset => (bus === 5 ? 2 : 1);

const channelOf = (bus: Bus): number => bus + 4; // 0-based: MIDI channels 6–10

export type BcrEvent =
  | { kind: "param"; bus: Bus; slot: number; value: number } // slot 0–5
  | { kind: "morph"; bus: Bus; value: number }
  | { kind: "button"; bus: Bus; cc: number };

const busOf = (channel: number): Bus | undefined => {
  const bus = channel - 4;
  return bus >= 1 && bus <= 5 ? (bus as Bus) : undefined;
};

function eventFor(bus: Bus, cc: number, value: number): BcrEvent | undefined {
  const slot = PARAM_CCS.indexOf(cc as (typeof PARAM_CCS)[number]);
  if (slot >= 0) return { kind: "param", bus, slot, value };
  if (cc === MORPH_CC) return { kind: "morph", bus, value };
  if ((BUTTON_CCS as readonly number[]).includes(cc)) return { kind: "button", bus, cc };
  return undefined;
}

// What a message from the BCR means, if anything.
export function parseBcr(data: ArrayLike<number>): BcrEvent | undefined {
  const [status = 0, cc = 0, value = 0] = Array.from(data);
  if (data.length < 3 || (status & 0xf0) !== 0xb0) return undefined;
  const bus = busOf(status & 0x0f);
  return bus && eventFor(bus, cc, value);
}

export const bcrCc = (bus: Bus, cc: number, value: number): MidiMessage =>
  [0xb0 | channelOf(bus), cc, Math.max(0, Math.min(127, Math.round(value)))];
