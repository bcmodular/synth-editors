// The Patch-mode temporary patch: Common (74 bytes) + Tones 1–4 (129 bytes each), as raw bytes.
// A read arrives as DT1 packets that can split a block, so bytes are placed by address and tracked per byte.

import { addrToInt, dt1Packets, type Address } from "./sysex";

export interface BlockDef {
  name: string;
  addr: Address;
  size: number;
}

export const COMMON_SIZE = 0x4a;
export const TONE_SIZE = 129;

export const PATCH_BLOCKS: readonly BlockDef[] = [
  { name: "Common", addr: [0x03, 0x00, 0x00, 0x00], size: COMMON_SIZE },
  { name: "Tone 1", addr: [0x03, 0x00, 0x10, 0x00], size: TONE_SIZE },
  { name: "Tone 2", addr: [0x03, 0x00, 0x12, 0x00], size: TONE_SIZE },
  { name: "Tone 3", addr: [0x03, 0x00, 0x14, 0x00], size: TONE_SIZE },
  { name: "Tone 4", addr: [0x03, 0x00, 0x16, 0x00], size: TONE_SIZE },
];

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

// The whole patch as DT1s to the temporary patch: 9 packets (Common, then each tone as 128 + 1 bytes).
export function patchToDt1s(patch: PatchBuffer, device?: number): number[][] {
  return PATCH_BLOCKS.flatMap((def, i) => dt1Packets(def.addr, patch.blocks[i]!, device));
}

// --- Decoding for the spike's readout (the full parameter table comes in Phase 2) ---

const nibble16 = (bytes: readonly number[], offset: number) => ((bytes[offset] ?? 0) << 4) | (bytes[offset + 1] ?? 0);

export function patchName(common: readonly number[]): string {
  return String.fromCharCode(...common.slice(0, 12)).trimEnd();
}

export interface CommonSummary {
  name: string;
  efxType: number; // 1–40
  reverbType: number; // 0–7
  level: number;
  pan: number; // −64…+63
  tempo: number;
}

export function commonSummary(common: readonly number[]): CommonSummary {
  return {
    name: patchName(common),
    efxType: (common[0x0c] ?? 0) + 1,
    reverbType: common[0x27] ?? 0,
    level: common[0x2e] ?? 0,
    pan: (common[0x2f] ?? 64) - 64,
    tempo: nibble16(common, 0x2c),
  };
}

export interface ToneSummary {
  on: boolean;
  groupType: number; // 0 = INT, 2 = EXP
  groupId: number; // raw; which values are INT-A and INT-B is one of the spike's questions
  wave: number; // 1–255
  filterType: number; // 0–4 = OFF, LPF, BPF, HPF, PKG
  cutoff: number;
  resonance: number;
  level: number;
  reverbSend: number; // offset 128, the byte past the first 128-byte packet
}

export function toneSummary(tone: readonly number[]): ToneSummary {
  return {
    on: tone[0x00] === 1,
    groupType: tone[0x01] ?? 0,
    groupId: tone[0x02] ?? 0,
    wave: nibble16(tone, 0x03) + 1,
    filterType: tone[0x50] ?? 0,
    cutoff: tone[0x51] ?? 0,
    resonance: tone[0x53] ?? 0,
    level: tone[0x65] ?? 0,
    reverbSend: tone[128] ?? 0,
  };
}
