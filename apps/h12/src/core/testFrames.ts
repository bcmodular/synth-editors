// Answer frames as the H12 sends them, for the unit tests.

import { checksum, encodeWord, HEADER, HUB } from "./sysex";

const byte = (v: number) => [v & 0x0f, (v >> 4) & 0x0f];
const frame = (body: number[]) => [...HEADER, HUB, ...body, checksum(body), 0xf7];

// Status 0: firmware (major.minor in nibbles), product ID, three serial words.
export function firmwareAnswer(fw = 0x47, serial = [0x01020304, 0x05060708, 0x090a0b0c], productId = HUB) {
  const payload = [...byte(fw), ...byte(productId), ...serial.flatMap(encodeWord)];
  return frame([0x41, 0x00, payload.length, ...payload]);
}

// Setting 4: the current preset (0-based).
export const presetAnswer = (preset: number) => frame([0x42, 0x04, 0x01, 0x00, ...encodeWord(preset)]);

export const errorAnswer = (command: number, code: number) => {
  const body = [command | 0x40, code];
  return [...HEADER, HUB, ...body, checksum(body), 0xf7];
};
