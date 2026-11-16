// The Launchkey MK4's MIDI, as the TouchOSC layout read it (keyboard_manager.lua): keys on any channel but 10, the
// 16 drum pads on channel 10 (notes 36–51, in two rows), the six encoders as CC 21–26 on channel 1 (a custom mode set
// up in Novation Components), the sustain pedal (CC 64) and pitch bend. And the notes played on the SP-404: at most
// four at once (the oldest gives way), held by the sustain pedal until it's let go.

import type { MidiMessage } from "../core/midi";

export type LaunchkeyEvent =
  | { type: "key"; note: number; velocity: number } // velocity 0 = released
  | { type: "pad"; pad: number } // 0–15, top row first; presses only
  | { type: "encoder"; slot: number; value: number } // slot 0–5
  | { type: "sustain"; down: boolean }
  | { type: "bend"; lsb: number; msb: number };

const PADS_CHANNEL = 9;
export const ENCODER_CC = 21;
export const ENCODERS = 6;
const SUSTAIN = 64;

// Drum pad notes → pad: top row 40–43 and 48–51, bottom row 36–39 and 44–47.
const PAD_OF = new Map<number, number>([
  [40, 0], [41, 1], [42, 2], [43, 3], [48, 4], [49, 5], [50, 6], [51, 7],
  [36, 8], [37, 9], [38, 10], [39, 11], [44, 12], [45, 13], [46, 14], [47, 15],
]);

// A channel message's channel (0-based) and two data bytes.
interface Message {
  channel: number;
  d1: number;
  d2: number;
}

function noteEvent({ channel, d1: note, d2: velocity }: Message): LaunchkeyEvent | undefined {
  if (channel !== PADS_CHANNEL) return { type: "key", note, velocity };
  const pad = PAD_OF.get(note);
  return pad !== undefined && velocity > 0 ? { type: "pad", pad } : undefined;
}

// The encoder slot a CC on channel 1 is, if any.
const encoderSlot = ({ channel, d1: cc }: Message): number | undefined => {
  const slot = cc - ENCODER_CC;
  return channel === 0 && slot >= 0 && slot < ENCODERS ? slot : undefined;
};

function ccEvent(m: Message): LaunchkeyEvent | undefined {
  const { channel, d1: cc, d2: value } = m;
  const slot = encoderSlot(m);
  if (slot !== undefined) return { type: "encoder", slot, value };
  if (cc === SUSTAIN && channel !== PADS_CHANNEL) return { type: "sustain", down: value >= 64 };
  return undefined;
}

export function parseLaunchkey(data: ArrayLike<number>): LaunchkeyEvent | undefined {
  const status = (data[0] ?? 0) & 0xf0;
  const m: Message = { channel: (data[0] ?? 0) & 0x0f, d1: data[1] ?? 0, d2: data[2] ?? 0 };
  if (status === 0x90) return noteEvent(m);
  if (status === 0x80) return noteEvent({ ...m, d2: 0 });
  if (status === 0xb0) return ccEvent(m);
  if (status === 0xe0) return { type: "bend", lsb: m.d1, msb: m.d2 };
  return undefined;
}

// An encoder's ring (the Launchkey shows the value it's sent back).
export const encoderMessage = (slot: number, value: number): MidiMessage => [0xb0, ENCODER_CC + slot, value];

export const MAX_VOICES = 4;

// A note on a channel (0-based).
export interface Played {
  channel: number;
  note: number;
}

const key = ({ channel, note }: Played) => `${channel}:${note}`;
const noteOff = (k: string): MidiMessage => {
  const [channel, note] = k.split(":").map(Number) as [number, number];
  return [0x90 | channel, note, 0];
};

// The notes sounding on the SP-404, oldest first.
export class Voices {
  private readonly sounding: string[] = [];
  private readonly released = new Set<string>(); // let go while the pedal is down
  private sustain = false;

  on(p: Played, velocity: number): MidiMessage[] {
    const k = key(p);
    const out: MidiMessage[] = [];
    this.drop(k);
    if (this.sounding.length >= MAX_VOICES) out.push(noteOff(this.evict()));
    this.sounding.push(k);
    out.push([0x90 | p.channel, p.note, velocity]);
    return out;
  }

  off(p: Played): MidiMessage[] {
    const k = key(p);
    if (!this.sounding.includes(k)) return [];
    if (this.sustain) {
      this.released.add(k);
      return [];
    }
    this.drop(k);
    return [noteOff(k)];
  }

  // The pedal goes to the channel being played, and letting it go ends the notes let go meanwhile.
  pedal(down: boolean, channel: number): MidiMessage[] {
    if (down === this.sustain) return [];
    this.sustain = down;
    const out: MidiMessage[] = [[0xb0 | channel, SUSTAIN, down ? 127 : 0]];
    if (down) return out;
    for (const k of [...this.released]) {
      this.drop(k);
      out.push(noteOff(k));
    }
    return out;
  }

  // Everything off (the keyboard is attached elsewhere).
  flush(): MidiMessage[] {
    const out = this.sounding.map(noteOff);
    this.sounding.splice(0);
    this.released.clear();
    this.sustain = false;
    return out;
  }

  notes(): number[] {
    return this.sounding.map((k) => Number(k.split(":")[1]));
  }

  private evict(): string {
    const k = this.sounding.shift()!;
    this.released.delete(k);
    return k;
  }

  private drop(k: string) {
    const i = this.sounding.indexOf(k);
    if (i >= 0) this.sounding.splice(i, 1);
    this.released.delete(k);
  }
}
