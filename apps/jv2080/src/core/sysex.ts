// Roland JV-2080 SysEx: DT1 (data set) and RQ1 (data request). See docs/jv2080-sysex-map.md.
//   DT1: F0 41 [dev] 6A 12 [addr×4] [data…]  [checksum] F7
//   RQ1: F0 41 [dev] 6A 11 [addr×4] [size×4] [checksum] F7
// Addresses and sizes are 7 bits per byte, so offsets past 127 carry into the next address byte
// (Tone offset 128 is at sub-address 01 00).

export const MODEL_ID = 0x6a;
export const DEFAULT_DEVICE_ID = 0x10; // shown as 17 on the JV
const CMD_RQ1 = 0x11;
const CMD_DT1 = 0x12;
// The JV wants bulk data in packets of at most 128 bytes, at least 20 ms apart (manual p.187).
export const MAX_PACKET = 128;

export type Address = readonly [number, number, number, number];

const header = (device: number, cmd: number) => [0xf0, 0x41, device, MODEL_ID, cmd];

// Base-128 conversions, for address arithmetic and 4-byte sizes.
export function addrToInt(addr: ArrayLike<number>): number {
  let n = 0;
  for (let i = 0; i < 4; i++) n = n * 128 + ((addr[i] ?? 0) & 0x7f);
  return n;
}

export function intToAddr(n: number): Address {
  return [(n >> 21) & 0x7f, (n >> 14) & 0x7f, (n >> 7) & 0x7f, n & 0x7f];
}

export function addOffset(addr: Address, offset: number): Address {
  return intToAddr(addrToInt(addr) + offset);
}

export function addrHex(addr: ArrayLike<number>): string {
  return Array.from({ length: 4 }, (_, i) => (addr[i] ?? 0).toString(16).toUpperCase().padStart(2, "0")).join(" ");
}

export function checksum(bytes: readonly number[]): number {
  const sum = bytes.reduce((a, b) => a + b, 0);
  return (128 - (sum % 128)) % 128;
}

export function rq1(addr: Address, size: number, device = DEFAULT_DEVICE_ID): number[] {
  const body = [...addr, ...intToAddr(size)];
  return [...header(device, CMD_RQ1), ...body, checksum(body), 0xf7];
}

export function dt1(addr: Address, data: readonly number[], device = DEFAULT_DEVICE_ID): number[] {
  const body = [...addr, ...data];
  return [...header(device, CMD_DT1), ...body, checksum(body), 0xf7];
}

// One DT1 per ≤ 128-byte run, each at the address its first byte belongs to.
export function dt1Packets(addr: Address, data: readonly number[], device = DEFAULT_DEVICE_ID): number[][] {
  const packets: number[][] = [];
  for (let i = 0; i < data.length; i += MAX_PACKET) {
    packets.push(dt1(addOffset(addr, i), data.slice(i, i + MAX_PACKET), device));
  }
  return packets;
}

// Two-byte (#) parameters: high nibble first (Wave Number, Patch Tempo).
export function nibbles(value: number): [number, number] {
  const v = Math.max(0, Math.min(255, Math.round(value)));
  return [v >> 4, v & 0x0f];
}

export interface Dt1Message {
  device: number;
  addr: Address;
  data: number[];
  checksumOk: boolean;
}

const MIN_DT1_LENGTH = 12; // header 5 + address 4 + one data byte + checksum + F7
// Expected bytes at fixed positions; position 2 (device ID) is free.
const DT1_SHAPE: readonly [number, number][] = [[0, 0xf0], [1, 0x41], [3, MODEL_ID], [4, CMD_DT1], [-1, 0xf7]];

function isJvDt1(bytes: readonly number[]): boolean {
  return bytes.length >= MIN_DT1_LENGTH && DT1_SHAPE.every(([i, b]) => bytes.at(i) === b);
}

// A JV-2080 DT1 from any device ID, or undefined for anything else.
export function parseDt1(msg: ArrayLike<number>): Dt1Message | undefined {
  const bytes = Array.from(msg);
  if (!isJvDt1(bytes)) return undefined;
  const device = bytes[2]!;
  const addr = bytes.slice(5, 9) as unknown as Address;
  const data = bytes.slice(9, -2);
  return { device, addr, data, checksumOk: bytes[bytes.length - 2] === checksum([...addr, ...data]) };
}
