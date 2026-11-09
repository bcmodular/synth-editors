// Control-channel (0x05) messages for the SP-404 MK2's USB serial port: setting pad parameters and bank volume,
// reading pad blocks and polling status. From the SparkyMK2 protocol notes (see serialFrames.ts); none of
// their code. Payloads start with a command byte; requests set bit 7 and replies clear it (9E → 1E).

import type { MixChange, MixField, PadMix, Routing } from "./mixer";
import { CHANNEL_CONTROL, longFrame, shortFrame, type Frame } from "./serialFrames";

const CMD_SET_PARAM = 0x01;
const CMD_READ_PAD = 0x9e;
const REPLY_PAD = 0x1e;
const CMD_STATUS = 0xfe;
const REPLY_STATUS = 0x7e;
const GLOBAL_TARGET = 0xffff;
const BANK_VOLUME_ID = 0x35; // + bank (0 = A)

// Parameter ids for the mixer's values. Pan is "Balance" and routing "BUS FX Assign" in the notes.
export const PARAM_IDS: Record<MixField, number> = {
  level: 0x69,
  muteGroup: 0x6d,
  pan: 0x78,
  routing: 0x7a,
  attack: 0x7d,
  hold: 0x7e,
  release: 0x7f,
};

const u16 = (v: number): number[] => [v & 0xff, (v >> 8) & 0xff];

function i32(v: number): number[] {
  const bytes = new Uint8Array(4);
  new DataView(bytes.buffer).setInt32(0, v, true);
  return Array.from(bytes);
}

// Set parameter `id` of `target` (a pad 0–159, or FFFF for a global): 01 id 00 target:u16 value:i32.
export const setParamFrame = (target: number, id: number, value: number): Uint8Array =>
  longFrame(CHANNEL_CONTROL, [CMD_SET_PARAM, id, 0x00, ...u16(target), ...i32(Math.round(value))]);

export const mixChangeFrame = ({ pad, field, value }: MixChange): Uint8Array =>
  setParamFrame(pad, PARAM_IDS[field], value);

// Bank volume 0–127 for bank 0–9 (A–J). The device stores it inverted.
export const bankVolumeFrame = (bank: number, volume: number): Uint8Array =>
  setParamFrame(GLOBAL_TARGET, BANK_VOLUME_ID + bank, 127 - volume);

export const readPadFrame = (pad: number): Uint8Array => shortFrame(CHANNEL_CONTROL, [CMD_READ_PAD, ...u16(pad)]);

// Sent every 500 ms.
export const statusFrame = (): Uint8Array => shortFrame(CHANNEL_CONTROL, [CMD_STATUS, 0x66, 0x00]);

// ---- replies

const isReply = (frame: Frame, command: number): boolean =>
  frame.channel === CHANNEL_CONTROL && frame.payload[0] === command;

const view = (bytes: Uint8Array): DataView => new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

// Pad block: 1E pad:u16, then 43 u32 fields from byte 3 (field k at 3 + 4k), then the name.
export const PAD_BLOCK_SIZE = 327;
const FIELDS_AT = 3;
const NAME_AT = 175;
const NAME_SIZE = 24;
const FIELD = { size: 0, level: 3, muteGroup: 7, pan: 18, routing: 20, attack: 22, hold: 23, release: 24 } as const;

export interface PadBlock {
  pad: number;
  // field 0, the sample file size, is 0 on an empty pad
  empty: boolean;
  name: string;
  mix: PadMix;
}

function decodeName(bytes: Uint8Array): string {
  const end = bytes.indexOf(0);
  const chars = end >= 0 ? bytes.subarray(0, end) : bytes;
  return String.fromCharCode(...chars).trimEnd();
}

function decodeMix(field: (k: number) => number): PadMix {
  return {
    level: field(FIELD.level),
    pan: field(FIELD.pan),
    routing: field(FIELD.routing) as Routing,
    muteGroup: field(FIELD.muteGroup),
    attack: field(FIELD.attack),
    hold: field(FIELD.hold),
    release: field(FIELD.release),
  };
}

// The reply to readPadFrame, or undefined if the frame is something else or too short.
export function parsePadBlock(frame: Frame): PadBlock | undefined {
  const bytes = frame.payload;
  if (!isReply(frame, REPLY_PAD) || bytes.length < PAD_BLOCK_SIZE) return undefined;
  const data = view(bytes);
  const field = (k: number) => data.getUint32(FIELDS_AT + 4 * k, true);
  return {
    pad: data.getUint16(1, true),
    empty: field(FIELD.size) === 0,
    name: decodeName(bytes.subarray(NAME_AT, NAME_AT + NAME_SIZE)),
    mix: decodeMix(field),
  };
}

// Status reply: 7E project 00 bank ? pad ? ? frames:u32 … (19 bytes).
const STATUS_SIZE = 19;
const NOT_PLAYING = 0xffffffff;
const PADS_IN_BANK = 16;

export interface DeviceStatus {
  project: number; // 0-based
  selectedBank: number; // 0 = A
  selectedPad: number; // 0–15 within the bank; hitting a pad selects it (checked on the device)
  // Frames played by the selected pad while it sounds, or undefined when nothing is playing.
  playingFrames: number | undefined;
}

// The selected pad as the mixer numbers it (bank × 16 + pad).
export const selectedPadNumber = (s: DeviceStatus): number => s.selectedBank * PADS_IN_BANK + s.selectedPad;

// The pad that's sounding, if any. The device only reports the last pad hit, so a pad still ringing after another
// is hit isn't shown.
export const soundingPad = (s: DeviceStatus): number | undefined =>
  s.playingFrames === undefined ? undefined : selectedPadNumber(s);

export function parseStatus(frame: Frame): DeviceStatus | undefined {
  const bytes = frame.payload;
  if (!isReply(frame, REPLY_STATUS) || bytes.length < STATUS_SIZE) return undefined;
  const frames = view(bytes).getUint32(8, true);
  return {
    project: bytes[1] ?? 0,
    selectedBank: bytes[3] ?? 0,
    selectedPad: bytes[5] ?? 0,
    playingFrames: frames === NOT_PLAYING ? undefined : frames,
  };
}
