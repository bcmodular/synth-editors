// The BCR2000's side of the app: keeps what each LED ring shows and sends a ring a value whenever the app's differs
// (a value the BCR just sent isn't sent back), keeps the unused buttons dark, and copes with one BCR switching between
// its two presets (buses 1–4, bus 5): the first message from the other preset is dropped and that preset's rings
// are sent again, as the BCR has just loaded its stored positions (docs/sp404-design.md › Controllers › BCR2000).

import type { MidiMessage } from "../core/midi";
import { BUSES, type Bus } from "../core/fxTypes";
import { BUTTON_CCS, bcrCc, MORPH_CC, PARAM_CCS, parseBcr, presetOf, SLOTS, type BcrEvent, type BcrPreset } from "./bcrMap";

// Per bus: the six parameter rings, then the morph amount ring.
export type Rings = Record<Bus, readonly number[]>;
const MORPH = SLOTS;
const RING_CCS: readonly number[] = [...PARAM_CCS, MORPH_CC];

export interface RingSource {
  fxId: number;
  values: readonly number[];
  morph?: number; // 0–1, while morph is on and has a target
}

// What the rings should show: the bus's values (0 for slots its effect doesn't have, or with no effect) and morph.
export function ringsFor(buses: Record<Bus, RingSource>): Rings {
  const one = (b: RingSource) => [
    ...Array.from({ length: SLOTS }, (_, i) => (b.fxId ? b.values[i] ?? 0 : 0)),
    Math.round((b.morph ?? 0) * 127),
  ];
  return { 1: one(buses[1]), 2: one(buses[2]), 3: one(buses[3]), 4: one(buses[4]), 5: one(buses[5]) };
}

const buttonsOff = (bus: Bus): MidiMessage[] => BUTTON_CCS.map((cc) => bcrCc(bus, cc, 0));
const ringIndex = (e: BcrEvent): number => (e.kind === "param" ? e.slot : MORPH);

export class BcrLink {
  private shown: Partial<Record<Bus, number[]>> = {};
  private preset: BcrPreset | undefined;

  constructor(private readonly out: (messages: MidiMessage[]) => void) {}

  // A BCR has appeared: every ring and button is unknown.
  connect(want: Rings): void {
    this.shown = {};
    this.preset = undefined;
    this.out(BUSES.flatMap(buttonsOff));
    this.update(want);
  }

  // Send the rings that differ from what they show.
  update(want: Rings): void {
    const messages: MidiMessage[] = [];
    for (const bus of BUSES) {
      const shown = (this.shown[bus] ??= []);
      want[bus].forEach((v, i) => {
        if (shown[i] === v) return;
        shown[i] = v;
        messages.push(bcrCc(bus, RING_CCS[i] ?? MORPH_CC, v));
      });
    }
    if (messages.length > 0) this.out(messages);
  }

  // A message from the BCR: the event for the app to act on, if any. After acting (or not), the app calls update.
  receive(data: ArrayLike<number>, want: Rings): BcrEvent | undefined {
    const e = parseBcr(data);
    if (!e) return undefined;
    if (e.kind === "button") return void this.out([bcrCc(e.bus, e.cc, 0)]);
    if (presetOf(e.bus) !== this.preset) return void this.switchPreset(presetOf(e.bus), want);
    (this.shown[e.bus] ??= [])[ringIndex(e)] = e.value;
    return e;
  }

  private switchPreset(preset: BcrPreset, want: Rings): void {
    this.preset = preset;
    for (const bus of BUSES) if (presetOf(bus) === preset) delete this.shown[bus];
    this.update(want);
  }
}
