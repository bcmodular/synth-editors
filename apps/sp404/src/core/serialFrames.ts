// Transport framing for the SP-404 MK2's vendor USB serial port (CDC-ACM 0582:02E7, 921600 baud 8N1, DTR and
// RTS raised). Written from the reverse-engineered protocol notes of the SparkyMK2 project
// (https://github.com/TuscanPL/SparkyMK2/tree/main/docs/re, firmware 5.52). We use their notes only and none
// of their code.
//
// Every message starts with a header (integers little-endian, no checksum or escaping):
//   0 kind (0x12 short, 0x13 long) · 1 source · 2 destination · 3 channel
//   short: 12 bytes in all, payload in bytes 4–10, payload length in byte 11
//   long:  16-byte header, payload length u32 at bytes 12–15, then the payload
// Bytes 4–11 of a long header are unused by the host and left zero.

export const SERIAL_USB_ID = { vendorId: 0x0582, productId: 0x02e7 } as const;
export const SERIAL_BAUD = 921600;

export const KIND_SHORT = 0x12;
export const KIND_LONG = 0x13;
export const HOST = 0x60;
export const DEVICE = 0xe0;
export const CHANNEL_CONTROL = 0x05;

const SHORT_SIZE = 12;
const SHORT_PAYLOAD_MAX = 7;
const SHORT_LENGTH_AT = 11;
const LONG_HEADER = 16;
const LONG_LENGTH_AT = 12;
const HEADER_FIELDS = 4;

export interface Frame {
  kind: number;
  source: number;
  destination: number;
  channel: number;
  payload: Uint8Array;
}

function header(size: number, kind: number, channel: number): Uint8Array {
  const out = new Uint8Array(size);
  out.set([kind, HOST, DEVICE, channel]);
  return out;
}

// A host → device short message. The device ignores one with an empty payload.
export function shortFrame(channel: number, payload: ArrayLike<number>): Uint8Array {
  if (payload.length < 1 || payload.length > SHORT_PAYLOAD_MAX) {
    throw new RangeError(`short payload must be 1–${SHORT_PAYLOAD_MAX} bytes, got ${payload.length}`);
  }
  const out = header(SHORT_SIZE, KIND_SHORT, channel);
  out.set(Array.from(payload), HEADER_FIELDS);
  out[SHORT_LENGTH_AT] = payload.length;
  return out;
}

// A host → device long message.
export function longFrame(channel: number, payload: ArrayLike<number>): Uint8Array {
  const out = header(LONG_HEADER + payload.length, KIND_LONG, channel);
  new DataView(out.buffer).setUint32(LONG_LENGTH_AT, payload.length, true);
  out.set(Array.from(payload), LONG_HEADER);
  return out;
}

// Size of the frame starting at `bytes[0]`: undefined while more bytes are needed, 0 if it isn't a frame start.
function frameSize(bytes: Uint8Array): number | undefined {
  const kind = bytes[0];
  if (kind === KIND_SHORT) return bytes.length >= SHORT_SIZE ? SHORT_SIZE : undefined;
  if (kind !== KIND_LONG) return 0;
  if (bytes.length < LONG_HEADER) return undefined;
  return LONG_HEADER + new DataView(bytes.buffer, bytes.byteOffset).getUint32(LONG_LENGTH_AT, true);
}

function decodeFrame(bytes: Uint8Array): Frame {
  const [kind = 0, source = 0, destination = 0, channel = 0] = bytes;
  const payload = kind === KIND_SHORT
    ? bytes.slice(HEADER_FIELDS, HEADER_FIELDS + Math.min(bytes[SHORT_LENGTH_AT] ?? 0, SHORT_PAYLOAD_MAX))
    : bytes.slice(LONG_HEADER);
  return { kind, source, destination, channel, payload };
}

// Split a received byte stream into whole frames. USB transfers can split or pack messages, so the bytes of a
// partial frame at the end come back in `rest` to be prefixed to the next read. Bytes that can't start a frame
// are skipped (and counted) so the reader finds its way back.
export function splitFrames(stream: Uint8Array): { frames: Frame[]; rest: Uint8Array; skipped: number } {
  const frames: Frame[] = [];
  let at = 0;
  let skipped = 0;
  while (at < stream.length) {
    const size = frameSize(stream.subarray(at));
    if (size === undefined || at + size > stream.length) break;
    if (size === 0) {
      skipped++;
      at++;
      continue;
    }
    frames.push(decodeFrame(stream.subarray(at, at + size)));
    at += size;
  }
  return { frames, rest: stream.slice(at), skipped };
}
