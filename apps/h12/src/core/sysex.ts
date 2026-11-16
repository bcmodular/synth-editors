// The H12MIDI Pro's SysEx frame (docs/h12-spec.md › H12 SysEx protocol; CME's published MIDI implementation):
//   F0 00 20 63 0F 26 cc pp [ss ii dd…] ck F7
// cc is the command (answers set bit 6), pp the action, status or setting ID. Values are 7-bit encoded, least
// significant part first. This module only builds read requests: nothing here can write to the H12.

export const HEADER = [0xf0, 0x00, 0x20, 0x63, 0x0f] as const;
export const HUB = 0x26; // the hub side's product ID; everything here talks to it

export const Command = { action: 0x00, readStatus: 0x01, readSetting: 0x02, writeSetting: 0x03 } as const;
const ANSWER = 0x40;
const COMMAND_BITS = 0x0f;
const BODY = HEADER.length + 1; // byte 6, the command

export const ERRORS: Record<number, string> = {
  0x7a: "unexpected parameter",
  0x7b: "BLE not connected",
  0x7c: "parameter out of range",
  0x7d: "wrong end of SysEx",
  0x7e: "wrong checksum",
  0x7f: "unknown command or parameter",
};

// The low 7 bits of the sum of every byte from the command to the last payload byte.
export const checksum = (bytes: readonly number[]): number => bytes.reduce((a, b) => a + b, 0) & 0x7f;

const frame = (body: number[]): number[] => [...HEADER, HUB, ...body, checksum(body), 0xf7];

// Status 0 (serial and firmware) has no index; the others (e.g. 0x02, USB device on a port) add one.
export const readStatus = (id: number, index?: number): number[] =>
  frame(index === undefined ? [Command.readStatus, id] : [Command.readStatus, id, index]);

export const readSetting = (id: number, words: number, index: number): number[] =>
  frame([Command.readSetting, id, words, index]);

// Decoders for the three encodings: a byte (2 SysEx bytes), an Int16 (3) and a 32-bit word (5).
export const decodeByte = (d: readonly number[], at: number): number => (d[at]! & 0x0f) | ((d[at + 1]! & 0x0f) << 4);

export const decodeInt16 = (d: readonly number[], at: number): number =>
  (d[at]! & 0x03) | ((d[at + 1]! & 0x7f) << 2) | ((d[at + 2]! & 0x7f) << 9);

export const decodeWord = (d: readonly number[], at: number): number =>
  ((d[at]! & 0x0f) | ((d[at + 1]! & 0x7f) << 4) | ((d[at + 2]! & 0x7f) << 11) | ((d[at + 3]! & 0x7f) << 18)
    | ((d[at + 4]! & 0x7f) << 25)) >>> 0;

export function encodeWord(v: number): number[] {
  return [v & 0x0f, (v >>> 4) & 0x7f, (v >>> 11) & 0x7f, (v >>> 18) & 0x7f, (v >>> 25) & 0x7f];
}

export type Answer =
  | { kind: "answer"; command: number; id: number; bytes: number[] } // bytes: the whole frame
  | { kind: "error"; command: number; code: number; message: string }
  | { kind: "corrupt"; command: number; bytes: number[] }; // the checksum doesn't match: report it, don't use it

const isHubFrame = (d: readonly number[]) =>
  d.length >= 10 && HEADER.every((b, i) => d[i] === b) && d[5] === HUB && d[d.length - 1] === 0xf7;

// An answer from the hub, or undefined for anything else (another device's SysEx, a request echoed back). An error
// answer is F0 00 20 63 0F 26 (cc|40) ee ck F7.
export function parseAnswer(data: ArrayLike<number>): Answer | undefined {
  const d = Array.from(data);
  if (!isHubFrame(d) || !(d[BODY]! & ANSWER)) return undefined;
  const command = d[BODY]! & COMMAND_BITS;
  if (checksum(d.slice(BODY, -2)) !== d[d.length - 2]) return { kind: "corrupt", command, bytes: d };
  const id = d[BODY + 1]!;
  if (d.length === 10 && id in ERRORS) return { kind: "error", command, code: id, message: ERRORS[id]! };
  return { kind: "answer", command, id, bytes: d };
}
