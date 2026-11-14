// The Patch-mode temporary patch: Common (74 bytes) + Tones 1–4 (129 bytes each), as raw bytes.
// `Patch` is an immutable value for the editor; `PatchBuffer` collects one as it arrives from the JV (a reply may
// split a block, so bytes are placed by address and tracked per byte).

import { splitSysex } from "@synth-editors/midi";
import { type ParamDef } from "./params";
import { encodeParam, paramWidth, readParam } from "./paramValue";
import { addOffset, addrToInt, dt1, dt1Packets, parseDt1, type Address } from "./sysex";

export interface BlockDef {
  name: string;
  addr: Address;
  size: number;
}

export const COMMON_SIZE = 0x4a;
export const TONE_SIZE = 129;
export const NAME_LENGTH = 12;

export const PATCH_BLOCKS: readonly BlockDef[] = [
  { name: "Common", addr: [0x03, 0x00, 0x00, 0x00], size: COMMON_SIZE },
  { name: "Tone 1", addr: [0x03, 0x00, 0x10, 0x00], size: TONE_SIZE },
  { name: "Tone 2", addr: [0x03, 0x00, 0x12, 0x00], size: TONE_SIZE },
  { name: "Tone 3", addr: [0x03, 0x00, 0x14, 0x00], size: TONE_SIZE },
  { name: "Tone 4", addr: [0x03, 0x00, 0x16, 0x00], size: TONE_SIZE },
];

// Blocks in PATCH_BLOCKS order: [common, tone1, tone2, tone3, tone4].
export type Patch = readonly (readonly number[])[];

// --- Collecting a patch from DT1s ---

export interface PatchBuffer {
  blocks: number[][];
  received: boolean[][];
}

export function emptyPatch(): PatchBuffer {
  return {
    blocks: PATCH_BLOCKS.map((b) => new Array<number>(b.size).fill(0)),
    received: PATCH_BLOCKS.map((b) => new Array<boolean>(b.size).fill(false)),
  };
}

export interface Placement {
  block: number;
  offset: number;
  count: number;
}

// Writes a DT1's data into the block its address falls in. Bytes past the block's end are dropped.
export function placeDt1(patch: PatchBuffer, addr: Address, data: readonly number[]): Placement | undefined {
  const at = addrToInt(addr);
  for (let block = 0; block < PATCH_BLOCKS.length; block++) {
    const def = PATCH_BLOCKS[block]!;
    const offset = at - addrToInt(def.addr);
    if (offset < 0 || offset >= def.size) continue;
    const count = Math.min(data.length, def.size - offset);
    for (let i = 0; i < count; i++) {
      patch.blocks[block]![offset + i] = data[i]!;
      patch.received[block]![offset + i] = true;
    }
    return { block, offset, count };
  }
  return undefined;
}

export const receivedCount = (patch: PatchBuffer, block: number) => patch.received[block]!.filter(Boolean).length;
export const blockComplete = (patch: PatchBuffer, block: number) => patch.received[block]!.every(Boolean);
export const patchComplete = (patch: PatchBuffer) => PATCH_BLOCKS.every((_, i) => blockComplete(patch, i));

// The collected patch, once every byte has arrived.
export function bufferToPatch(buffer: PatchBuffer): Patch | undefined {
  return patchComplete(buffer) ? buffer.blocks.map((b) => [...b]) : undefined;
}

// --- .syx files: the whole patch as DT1s to the temporary patch ---

// 9 packets: Common, then each tone as 128 + 1 bytes (the JV wants ≤ 128 data bytes per packet).
export function patchToDt1s(patch: Patch, device?: number): number[][] {
  return PATCH_BLOCKS.flatMap((def, i) => dt1Packets(def.addr, patch[i]!, device));
}

export function encodeSyx(patch: Patch, device?: number): Uint8Array {
  return Uint8Array.from(patchToDt1s(patch, device).flat());
}

export type SyxError = "no-patch" | "incomplete" | "checksum";

// A patch from a .syx of DT1s to the temporary patch, in any packet split and from any device ID.
export function decodeSyx(bytes: ArrayLike<number>): { patch: Patch } | { error: SyxError } {
  const buffer = emptyPatch();
  let placed = 0;
  for (const message of splitSysex(bytes)) {
    const dt = parseDt1(message);
    if (!dt) continue;
    if (!dt.checksumOk) return { error: "checksum" };
    if (placeDt1(buffer, dt.addr, dt.data)) placed++;
  }
  const patch = bufferToPatch(buffer);
  if (patch) return { patch };
  return { error: placed ? "incomplete" : "no-patch" };
}

// --- Parameters ---

export const blockIndex = (p: ParamDef, tone = 0) => (p.block === "common" ? 0 : 1 + tone); // tone 0–3

export function getParam(patch: Patch, p: ParamDef, tone = 0): number {
  return readParam(patch[blockIndex(p, tone)]!, p);
}

export function setParam(patch: Patch, p: ParamDef, value: number, tone = 0): Patch {
  const index = blockIndex(p, tone);
  const block = [...patch[index]!];
  block.splice(p.offset, paramWidth(p), ...encodeParam(p, value));
  return patch.map((b, i) => (i === index ? block : b));
}

export function paramAddress(p: ParamDef, tone = 0): Address {
  return addOffset(PATCH_BLOCKS[blockIndex(p, tone)]!.addr, p.offset);
}

// One edit as a DT1 to the temporary patch (both nibbles for a two-byte value).
export function paramDt1(p: ParamDef, value: number, tone = 0, device?: number): number[] {
  return dt1(paramAddress(p, tone), encodeParam(p, value), device);
}

export function patchName(patch: Patch): string {
  return String.fromCharCode(...patch[0]!.slice(0, NAME_LENGTH)).trimEnd();
}

// Names are 12 characters of printable ASCII (32–125), space-padded.
export function setPatchName(patch: Patch, name: string): Patch {
  const chars = [...name.padEnd(NAME_LENGTH).slice(0, NAME_LENGTH)].map((c) => {
    const code = c.charCodeAt(0);
    return code >= 32 && code <= 125 ? code : 32;
  });
  const common = [...patch[0]!];
  common.splice(0, NAME_LENGTH, ...chars);
  return [common, ...patch.slice(1)];
}
