// Patch model: 11 raw blocks, immutable. Decodes from / encodes to DT1 messages, diffs and morphs.
import { EFX_BLOCK, efxTypes } from "./efx";
import type { EfxNum } from "./efx";
import { PARAMS, paramAddr } from "./params";
import type { BlockKey, ParamDef } from "./params";
import { PATCH_BLOCKS, addrKey, dt1, parseDt1 } from "./sysex";

export interface Patch {
  blocks: Record<BlockKey, number[]>;
}

const BLOCK_DEF = new Map(PATCH_BLOCKS.map((b) => [addrKey(b.addr), b]));

function blockDef(key: BlockKey) {
  const b = BLOCK_DEF.get(key);
  if (!b) throw new Error(`unknown block ${key}`);
  return b;
}

const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));

// Blocks are matched by address: real .syx files store them in size order, not request order.
export function patchFromSysex(messages: number[][]): Patch {
  const blocks: Record<BlockKey, number[]> = {};
  for (const msg of messages) {
    const m = parseDt1(msg);
    if (!m) throw new Error("not a DT1 message");
    const key = addrKey(m.addr);
    const def = BLOCK_DEF.get(key);
    if (!def) continue; // not a patch block (e.g. pattern data)
    if (!m.checksumOk) throw new Error(`bad checksum in block ${def.name} (${key})`);
    if (m.data.length !== def.size) {
      throw new Error(`block ${def.name} (${key}) has ${m.data.length} bytes, expected ${def.size}`);
    }
    blocks[key] = m.data;
  }
  for (const b of PATCH_BLOCKS) {
    if (!blocks[addrKey(b.addr)]) throw new Error(`missing block ${b.name} (${addrKey(b.addr)})`);
  }
  return { blocks };
}

export function patchToSysex(p: Patch): number[][] {
  return blocksToSysex(p, PATCH_BLOCKS.map((b) => addrKey(b.addr)));
}

export function blocksToSysex(p: Patch, keys: readonly BlockKey[]): number[][] {
  return keys.map((k) => dt1(blockDef(k).addr, p.blocks[k]!));
}

function withByte(p: Patch, key: BlockKey, offset: number, values: number[]): Patch {
  const data = [...p.blocks[key]!];
  values.forEach((v, i) => (data[offset + i] = v));
  return { blocks: { ...p.blocks, [key]: data } };
}

export function getRaw(p: Patch, def: ParamDef): number {
  const data = p.blocks[def.block]!;
  return def.encoding === "u16" ? data[def.offset]! * 16 + data[def.offset + 1]! : data[def.offset]!;
}

const clampRaw = (def: ParamDef, raw: number): number => clamp(Math.round(raw), 0, def.max);

const bytesFor = (def: ParamDef, raw: number): number[] =>
  def.encoding === "u16" ? [raw >> 4, raw & 0x0f] : [raw];

export function setRaw(p: Patch, def: ParamDef, raw: number): Patch {
  return withByte(p, def.block, def.offset, bytesFor(def, clampRaw(def, raw)));
}

// DT1 for a single parameter change.
export function encodeParam(def: ParamDef, raw: number): number[] {
  const v = clampRaw(def, raw);
  const addr = paramAddr(def);
  return dt1(addr, bytesFor(def, v)); // u16: msb = v>>4 may exceed 15 for assign slots
}

export const getEfxType = (p: Patch, efx: EfxNum): number => p.blocks[EFX_BLOCK[efx]]![0]!;

export function setEfxType(p: Patch, efx: EfxNum, type: number): Patch {
  return withByte(p, EFX_BLOCK[efx], 0, [clamp(Math.round(type), 0, efxTypes(efx).length - 1)]);
}

export const getEfxRaw = (p: Patch, efx: EfxNum, offset: number): number => p.blocks[EFX_BLOCK[efx]]![offset]!;

export function setEfxRaw(p: Patch, efx: EfxNum, offset: number, raw: number): Patch {
  const key = EFX_BLOCK[efx];
  if (offset < 0 || offset >= p.blocks[key]!.length) throw new RangeError(`EFX${efx} offset ${offset}`);
  return withByte(p, key, offset, [clamp(Math.round(raw), 0, 127)]);
}

// DT1 for one EFX byte (type at offset 0, switch, button or slot).
export function encodeEfxByte(efx: EfxNum, offset: number, raw: number): number[] {
  const [a0, a1, a2] = blockDef(EFX_BLOCK[efx]).addr;
  return dt1([a0, a1, a2, offset], [clamp(Math.round(raw), 0, 127)]);
}

// Blocks whose bytes differ, in PATCH_BLOCKS order.
export function diffBlocks(a: Patch, b: Patch): BlockKey[] {
  return PATCH_BLOCKS.map((blk) => addrKey(blk.addr)).filter((k) => {
    const x = a.blocks[k]!;
    const y = b.blocks[k]!;
    return x.length !== y.length || x.some((v, i) => v !== y[i]);
  });
}

// Per-block plan: bytes that interpolate (single u7, u16 pair, EFX slot) vs. everything else
// (switches, enums, assign slots, EFX type/switch/button bytes, unmapped bytes) which snap at 0.5.
interface MorphPlan {
  lerp7: Set<number>;
  lerp16: number[]; // first offset of each u16 pair
}

function buildPlans(): Map<BlockKey, MorphPlan> {
  const plans = new Map<BlockKey, MorphPlan>(
    PATCH_BLOCKS.map((b) => [addrKey(b.addr), { lerp7: new Set(), lerp16: [] }]),
  );
  for (const def of PARAMS) {
    if (def.kind !== "continuous") continue;
    const plan = plans.get(def.block)!;
    if (def.encoding === "u16") plan.lerp16.push(def.offset);
    else plan.lerp7.add(def.offset);
  }
  for (const efx of [1, 2] as const) {
    const plan = plans.get(EFX_BLOCK[efx])!;
    for (const type of efxTypes(efx)) {
      for (const s of type.slots) if (s) plan.lerp7.add(s.offset);
    }
  }
  return plans;
}

const MORPH_PLANS = buildPlans();

export function morph(base: Patch, target: Patch, t: number): Patch {
  if (t <= 0) return base;
  if (t >= 1) return target;
  const lerp = (a: number, b: number) => Math.round(a + (b - a) * t);
  const blocks: Record<BlockKey, number[]> = {};
  for (const [key, plan] of MORPH_PLANS) {
    const a = base.blocks[key]!;
    const b = target.blocks[key]!;
    const out = (t < 0.5 ? a : b).slice();
    for (const o of plan.lerp7) out[o] = lerp(a[o]!, b[o]!);
    for (const o of plan.lerp16) {
      const v = lerp(a[o]! * 16 + a[o + 1]!, b[o]! * 16 + b[o + 1]!);
      out[o] = v >> 4;
      out[o + 1] = v & 0x0f;
    }
    blocks[key] = out;
  }
  return { blocks };
}
