// Read-only answers from the H12: status 0 (firmware and serial) and setting 4 (the current preset). Each parser takes a whole answer frame (core/sysex.ts parseAnswer's bytes).

import { decodeByte, decodeWord, HUB } from "./sysex";

// Status 2 (the USB device on a host port) isn't used: on firmware 4.7 it ignores the index and answers with what
// looks like raw memory (apps/h12/README.md › Findings).
export const Status = { firmware: 0x00 } as const;

// The firmware the spec was written against; anything older warns.
export const MIN_FIRMWARE = { major: 4, minor: 7 } as const;

export interface Firmware {
  major: number;
  minor: number;
  version: string; // "4.7"
  productId: number;
  serial: string; // 96 bits as 24 hex digits
}

const hexWord = (w: number) => w.toString(16).toUpperCase().padStart(8, "0");

// F0 00 20 63 0F 26 41 00 ss fw×2 id×2 serial×15 ck F7 (30 bytes). The firmware byte is major.minor in nibbles.
export function parseFirmware(d: readonly number[]): Firmware | undefined {
  if (d.length !== 30) return undefined;
  const fw = decodeByte(d, 9);
  const major = fw >> 4;
  const minor = fw & 0x0f;
  const serial = [13, 18, 23].map((at) => hexWord(decodeWord(d, at))).join("");
  return { major, minor, version: `${major}.${minor}`, productId: decodeByte(d, 11), serial };
}

export const firmwareOk = (f: Pick<Firmware, "major" | "minor">): boolean =>
  f.major > MIN_FIRMWARE.major || (f.major === MIN_FIRMWARE.major && f.minor >= MIN_FIRMWARE.minor);

export const isHub = (f: Firmware): boolean => f.productId === HUB;

export interface Preset {
  index: number; // 0–5; preset 1 on the device is index 0
  reload: boolean; // bit 31: read every per-preset setting again
}

// Setting 4, answered as F0 00 20 63 0F 26 42 04 01 00 <word> ck F7.
export function parsePreset(d: readonly number[]): Preset | undefined {
  return d.length === 17 ? presetOf(decodeWord(d, 10)) : undefined;
}

// Setting 4's word: bits 0–4 the preset, bit 31 reload.
export const presetOf = (v: number): Preset => ({ index: v & 0x1f, reload: (v & 0x80000000) !== 0 });
