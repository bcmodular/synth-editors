// Device → host frames captured from the user's SP-404 MK2 in the Phase 0 spike (2026-11-09), whole frames
// with their 16-byte headers. Only frames with no third-party content are kept here.

// Status reply, project 3, bank A selected, nothing playing.
export const STATUS_IDLE =
  "13 e0 91 05 f4 24 e0 82 08 9c 5b 83 13 00 00 00 7e 02 00 00 00 00 00 00 ff ff ff ff 00 00 00 01 " +
  "00 0b 33";

// Status reply while a pad in bank B was sounding (byte 5 = 1, frames 0x5000).
export const STATUS_PLAYING =
  "13 e0 ca 05 32 85 a6 bb 08 9c 5b 83 13 00 00 00 7e 02 00 01 00 01 00 00 00 50 00 00 00 00 00 01 " +
  "00 0b 33";

// Echo of "set pad 32 (C1) level 120".
export const ECHO_SET_LEVEL =
  "13 e0 e0 05 d4 09 e0 82 a8 89 5a 83 09 00 00 00 01 69 00 20 00 78 00 00 00";

// Pad block for pad 32 (C1), a loaded sample named "A01" (NUL-padded name).
export const PAD_BLOCK_LOADED =
  "13 e0 00 05 21 13 00 00 18 88 5a 83 47 01 00 00 1e 20 00 34 ac 7e 00 00 02 00 00 34 ac 7e 00 7f " +
  "00 00 00 01 00 00 00 00 00 00 00 01 00 00 00 00 00 00 00 00 00 00 00 3c 41 00 00 00 00 00 00 00 " +
  "02 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 10 27 00 00 01 00 00 00 40 00 00 00 00 " +
  "00 00 00 01 00 00 00 02 00 00 00 00 00 00 00 64 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 3c " +
  "41 00 00 00 00 00 00 01 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 64 00 00 00 00 00 00 00 00 " +
  "00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 41 " +
  "30 31 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 ff ff ff ff ff ff ff ff ff " +
  "ff ff ff ff ff ff ff ff ff ff ff ff ff ff ff ff ff ff ff ff ff ff ff ff ff ff ff ff ff ff ff ff " +
  "ff ff ff ff ff ff ff ff ff ff ff ff ff ff ff ff ff ff ff ff ff ff ff 00 00 00 00 00 00 00 00 00 " +
  "00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 " +
  "00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00";

// Pad block for pad 18 (B3), an empty pad (space-padded name).
export const PAD_BLOCK_EMPTY =
  "13 e0 00 05 21 13 00 00 18 88 5a 83 47 01 00 00 1e 12 00 00 00 00 00 00 00 00 00 00 00 00 00 7f " +
  "00 00 00 01 00 00 00 00 00 00 00 01 00 00 00 00 00 00 00 00 00 00 00 28 23 00 00 00 00 00 00 00 " +
  "00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 10 27 00 00 01 00 00 00 40 00 00 00 00 " +
  "00 00 00 01 00 00 00 02 00 00 00 00 00 00 00 64 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 28 " +
  "23 00 00 00 00 00 00 01 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 64 00 00 00 00 00 00 00 00 " +
  "00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 20 " +
  "20 20 20 20 20 20 20 20 20 20 20 20 20 20 20 20 20 20 20 20 20 20 00 ff ff ff ff ff ff ff ff ff " +
  "ff ff ff ff ff ff ff ff ff ff ff ff ff ff ff ff ff ff ff ff ff ff ff ff ff ff ff ff ff ff ff ff " +
  "ff ff ff ff ff ff ff ff ff ff ff ff ff ff ff ff ff ff ff ff ff ff ff 00 00 00 00 00 00 00 00 00 " +
  "00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 " +
  "00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00";

// Status reply while pad C6 sounded: bank 2, pad 5 within the bank.
export const STATUS_C6_PLAYING =
  "13 e0 ca 05 32 85 a6 bb 28 17 5a 83 13 00 00 00 7e 02 00 02 00 05 00 00 00 30 00 00 00 00 00 01 " +
  "00 0b 33";

// Status reply after C6 stopped: still selected, nothing playing.
export const STATUS_C6_SELECTED =
  "13 e0 ca 05 32 85 a6 bb 28 17 5a 83 13 00 00 00 7e 02 00 02 00 05 00 00 ff ff ff ff 00 00 00 01 " +
  "00 0b 33";

export const bytes = (hex: string): Uint8Array => new Uint8Array(hex.trim().split(/\s+/).map((h) => parseInt(h, 16)));
