// Project messages on the SP-404 MK2's serial control channel, from the SparkyMK2 notes (see serialFrames.ts):
// reading a project's settings (FD → 7D) and the device's "project changed" notice (1A).

import { CHANNEL_CONTROL, shortFrame, type Frame } from "./serialFrames";

const CMD_PROJECT_SETTINGS = 0xfd;
const REPLY_PROJECT_SETTINGS = 0x7d;
const NOTICE_PROJECT = 0x1a;

export const BANKS = 10;

// Settings reply: 7D project 00, then 28 u32 words from byte 3, then a 32-byte name at 115–146.
const SETTINGS_SIZE = 147;
const WORDS_AT = 3;
const NAME_AT = 115;
const NAME_SIZE = 32;
// Bank volumes, stored as 127 − volume: word 23 + bank / 2, even banks in bits 0–15, odd banks in bits 16–31.
// From the notes only: the Phase 0 capture had every bank at 127 (stored 0), so the packing isn't confirmed.
const BANK_VOLUME_WORD = 23;

export interface ProjectSettings {
  project: number; // 0-based
  name: string;
  bankVolumes: number[]; // 0–127, bank A first
}

export const projectSettingsFrame = (project: number): Uint8Array =>
  shortFrame(CHANNEL_CONTROL, [CMD_PROJECT_SETTINGS, project, 0x00]);

const isCommand = (frame: Frame, command: number): boolean =>
  frame.channel === CHANNEL_CONTROL && frame.payload[0] === command;

function bankVolume(data: DataView, bank: number): number {
  const word = data.getUint32(WORDS_AT + 4 * (BANK_VOLUME_WORD + Math.floor(bank / 2)), true);
  const stored = bank % 2 === 0 ? word & 0xffff : word >>> 16;
  return Math.max(0, Math.min(127, 127 - stored));
}

function decodeName(bytes: Uint8Array): string {
  const end = bytes.indexOf(0);
  return String.fromCharCode(...(end >= 0 ? bytes.subarray(0, end) : bytes)).trimEnd();
}

export function parseProjectSettings(frame: Frame): ProjectSettings | undefined {
  const bytes = frame.payload;
  if (!isCommand(frame, REPLY_PROJECT_SETTINGS) || bytes.length < SETTINGS_SIZE) return undefined;
  const data = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return {
    project: bytes[1] ?? 0,
    name: decodeName(bytes.subarray(NAME_AT, NAME_AT + NAME_SIZE)),
    bankVolumes: Array.from({ length: BANKS }, (_, bank) => bankVolume(data, bank)),
  };
}

// The device's notice that the current project changed or its pads were edited (1A project).
export function parseProjectNotice(frame: Frame): number | undefined {
  return isCommand(frame, NOTICE_PROJECT) ? frame.payload[1] : undefined;
}
