// The DT1s that turn one patch into another: only the changed bytes, in runs. Each run is one DT1 (split at 128
// bytes), so nearby changes are merged when sending the bytes between them costs less than another message.
// Within a run bytes are written in address order, so a new EFX Type (offset 12) lands before its parameters.

import { ALL_PARAMS, type ParamBlock } from "./params";
import { PATCH_BLOCKS, type Patch } from "./patch";
import { addOffset, dt1Packets } from "./sysex";

const blockKind = (block: number): ParamBlock => (block === 0 ? "common" : "tone");
const NIBBLED = ALL_PARAMS.filter((p) => p.nibbled);

// A DT1 costs 11 bytes besides its data, plus the gap between messages; merging across up to this many unchanged
// bytes is cheaper than starting a new message.
const MERGE_GAP = 8;

export interface Run {
  block: number;
  offset: number;
  length: number;
}

// Two-byte (nibbled) values must go out whole, so a change to either half marks both.
function changedOffsets(from: readonly number[], to: readonly number[], block: number): boolean[] {
  const changed = to.map((b, i) => b !== from[i]);
  for (const p of NIBBLED.filter((n) => n.block === blockKind(block))) {
    if (changed[p.offset] || changed[p.offset + 1]) changed[p.offset] = changed[p.offset + 1] = true;
  }
  return changed;
}

function runsIn(changed: readonly boolean[], block: number): Run[] {
  const runs: Run[] = [];
  changed.forEach((isChanged, offset) => {
    if (!isChanged) return;
    const last = runs.at(-1);
    if (last && offset - (last.offset + last.length) <= MERGE_GAP) last.length = offset + 1 - last.offset;
    else runs.push({ block, offset, length: 1 });
  });
  return runs;
}

export function diffRuns(from: Patch, to: Patch): Run[] {
  return PATCH_BLOCKS.flatMap((_, block) => runsIn(changedOffsets(from[block]!, to[block]!, block), block));
}

export function diffPatch(from: Patch, to: Patch, device?: number): number[][] {
  return diffRuns(from, to).flatMap((r) =>
    dt1Packets(addOffset(PATCH_BLOCKS[r.block]!.addr, r.offset), to[r.block]!.slice(r.offset, r.offset + r.length), device));
}
