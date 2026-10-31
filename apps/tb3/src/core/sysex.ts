// Roland TB-3 SysEx: DT1 (data set) and RQ1 (data request).
//   DT1: F0 41 10 00 00 7B 12 [addr×4] [data…]  [checksum] F7
//   RQ1: F0 41 10 00 00 7B 11 [addr×4] [size×4] [checksum] F7

const HEADER = [0xf0, 0x41, 0x10, 0x00, 0x00, 0x7b] as const;
const CMD_RQ1 = 0x11;
const CMD_DT1 = 0x12;

export type Address = readonly [number, number, number, number];

export interface BlockDef {
  name: string;
  addr: Address;
  size: number;
}

// The 11 sound blocks that make up a patch (no pattern data).
export const PATCH_BLOCKS: readonly BlockDef[] = [
  { name: "LFO", addr: [0x10, 0x00, 0x00, 0x00], size: 0x0d },
  { name: "CV Offset / Tuning", addr: [0x10, 0x00, 0x02, 0x00], size: 0x06 },
  { name: "Cross Modulation", addr: [0x10, 0x00, 0x04, 0x00], size: 0x0a },
  { name: "Ring Modulation", addr: [0x10, 0x00, 0x06, 0x00], size: 0x0e },
  { name: "VCO", addr: [0x10, 0x00, 0x08, 0x00], size: 0x0e },
  { name: "VCF", addr: [0x10, 0x00, 0x0a, 0x00], size: 0x0b },
  { name: "VCA", addr: [0x10, 0x00, 0x0c, 0x00], size: 0x05 },
  { name: "Distortion", addr: [0x10, 0x00, 0x0e, 0x00], size: 0x09 },
  { name: "EFX1", addr: [0x10, 0x00, 0x10, 0x00], size: 0x5f },
  { name: "EFX2", addr: [0x10, 0x00, 0x12, 0x00], size: 0x54 },
  { name: "Param Assign", addr: [0x10, 0x00, 0x14, 0x00], size: 0x12 },
];

export function addrKey(addr: ArrayLike<number>): string {
  return Array.from({ length: 4 }, (_, i) => (addr[i] ?? 0).toString(16).toUpperCase().padStart(2, "0")).join("");
}

export function checksum(bytes: readonly number[]): number {
  const sum = bytes.reduce((a, b) => a + b, 0);
  return (128 - (sum % 128)) % 128;
}

function sizeBytes(size: number): number[] {
  return [(size >> 21) & 0x7f, (size >> 14) & 0x7f, (size >> 7) & 0x7f, size & 0x7f];
}

export function rq1(addr: Address, size: number): number[] {
  const body = [...addr, ...sizeBytes(size)];
  return [...HEADER, CMD_RQ1, ...body, checksum(body), 0xf7];
}

export function dt1(addr: Address, data: readonly number[]): number[] {
  const body = [...addr, ...data];
  return [...HEADER, CMD_DT1, ...body, checksum(body), 0xf7];
}

// 16-bit params are nibble-packed across two consecutive addresses.
export function dt1Nibble16(addr: Address, value: number): number[] {
  const v = Math.max(0, Math.min(255, Math.round(value)));
  return dt1(addr, [v >> 4, v & 0x0f]);
}

export interface Dt1Message {
  addr: Address;
  data: number[];
  checksumOk: boolean;
}

export function parseDt1(msg: ArrayLike<number>): Dt1Message | undefined {
  if (msg.length < 14) return undefined;
  for (let i = 0; i < HEADER.length; i++) {
    if (msg[i] !== HEADER[i]) return undefined;
  }
  if (msg[6] !== CMD_DT1 || msg[msg.length - 1] !== 0xf7) return undefined;
  const bytes = Array.from(msg);
  const addr = bytes.slice(7, 11) as unknown as Address;
  const data = bytes.slice(11, -2);
  const cs = bytes[bytes.length - 2];
  return { addr, data, checksumOk: cs === checksum([...addr, ...data]) };
}
