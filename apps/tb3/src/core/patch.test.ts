import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { splitSysex } from "@synth-editors/midi";
import { efxTypes } from "./efx";
import { PARAMS, paramAddr, paramById } from "./params";
import type { ParamDef } from "./params";
import {
  blocksToSysex,
  diffBlocks,
  encodeParam,
  getEfxRaw,
  getEfxType,
  getRaw,
  morph,
  patchFromSysex,
  patchToSysex,
  setEfxRaw,
  setEfxType,
  setRaw,
} from "./patch";
import type { Patch } from "./patch";
import { PATCH_BLOCKS, addrKey, dt1, parseDt1 } from "./sysex";

// Deterministic synthetic patch: every byte within 0..15 so nibble pairs stay valid.
function synthetic(seed = 0): Patch {
  const blocks: Patch["blocks"] = {};
  PATCH_BLOCKS.forEach((b, bi) => {
    blocks[addrKey(b.addr)] = Array.from({ length: b.size }, (_, i) => (i * 5 + bi * 3 + seed) % 16);
  });
  return { blocks };
}

const p = (id: string): ParamDef => paramById(id);

describe("sysex round-trip", () => {
  it("round-trips a synthetic patch byte for byte", () => {
    const msgs = patchToSysex(synthetic());
    expect(msgs).toHaveLength(11);
    expect(patchToSysex(patchFromSysex(msgs))).toEqual(msgs);
  });

  it("matches blocks by address, not position", () => {
    const msgs = patchToSysex(synthetic());
    const shuffled = [...msgs].sort((a, b) => parseDt1(a)!.data.length - parseDt1(b)!.data.length);
    expect(patchFromSysex(shuffled)).toEqual(synthetic());
  });

  it("throws on a missing block, wrong size or bad checksum", () => {
    const msgs = patchToSysex(synthetic());
    expect(() => patchFromSysex(msgs.slice(1))).toThrow(/missing/);
    const short = parseDt1(msgs[0]!)!;
    expect(() => patchFromSysex([dt1(short.addr, short.data.slice(1)), ...msgs.slice(1)])).toThrow(/bytes/);
    const bad = [...msgs[0]!];
    bad[bad.length - 2] = (bad[bad.length - 2]! + 1) % 128;
    expect(() => patchFromSysex([bad, ...msgs.slice(1)])).toThrow(/checksum/);
  });
});

const FIXTURE_DIR = join(import.meta.dirname, "../../../../fixtures/local/tb3");
const files = existsSync(FIXTURE_DIR) ? readdirSync(FIXTURE_DIR).filter((f) => f.endsWith(".syx")) : [];

// Local third-party fixtures: only structural checks, nothing from them is committed.
describe.skipIf(files.length === 0)("local .syx fixtures", () => {
  it.each(files)("%s round-trips and decodes within range", (file) => {
    const msgs = splitSysex(readFileSync(join(FIXTURE_DIR, file)));
    const patch = patchFromSysex(msgs);
    const out = patchToSysex(patch);
    // File order differs from PATCH_BLOCKS order: compare by address.
    const key = (m: number[]) => addrKey(parseDt1(m)!.addr);
    const byKey = new Map(msgs.map((m) => [key(m), m]));
    for (const m of out) expect(m).toEqual(byKey.get(key(m)));

    for (const def of PARAMS) {
      const raw = getRaw(patch, def);
      expect(raw, def.id).toBeGreaterThanOrEqual(0);
      expect(raw, def.id).toBeLessThanOrEqual(def.max);
    }
    for (const n of [1, 2] as const) {
      expect(getEfxType(patch, n)).toBeLessThan(efxTypes(n).length);
    }
  });
});

describe("get/set", () => {
  it("reads and writes u7 and u16 values immutably", () => {
    const base = synthetic();
    const cutoff = p("vcf_cutoff");
    const next = setRaw(base, cutoff, 0xab);
    expect(getRaw(next, cutoff)).toBe(0xab);
    expect(next.blocks[cutoff.block]!.slice(0, 2)).toEqual([0xa, 0xb]);
    expect(getRaw(base, cutoff)).not.toBe(0xab);
    expect(getRaw(setRaw(base, p("vcf_attack"), 99), p("vcf_attack"))).toBe(99);
  });

  it("clamps to 0..max", () => {
    const base = synthetic();
    expect(getRaw(setRaw(base, p("dist_type"), 99), p("dist_type"))).toBe(24);
    expect(getRaw(setRaw(base, p("saw_tuning"), 255), p("saw_tuning"))).toBe(151);
    expect(getRaw(setRaw(base, p("vcf_attack"), -5), p("vcf_attack"))).toBe(0);
  });

  it("encodes one-param DT1 messages", () => {
    const cutoff = p("vcf_cutoff");
    const msg = parseDt1(encodeParam(cutoff, 0x7f))!;
    expect(msg.checksumOk).toBe(true);
    expect([...msg.addr]).toEqual([...paramAddr(cutoff)]);
    expect(msg.data).toEqual([7, 15]);
    expect(parseDt1(encodeParam(p("master_volume"), 100))!.data).toEqual([100]);
  });

  it("gets and sets EFX type and bytes", () => {
    const base = synthetic();
    const t = setEfxType(base, 1, 10);
    expect(getEfxType(t, 1)).toBe(10);
    expect(getEfxType(setEfxType(base, 2, 10), 2)).toBe(9); // EFX2 has no type 10
    expect(getEfxRaw(setEfxRaw(base, 2, 0x49, 77), 2, 0x49)).toBe(77);
    expect(() => setEfxRaw(base, 2, 0x54, 1)).toThrow();
  });
});

describe("diff", () => {
  it("changing one param touches exactly one block", () => {
    const base = synthetic();
    const cutoff = p("vcf_cutoff");
    const next = setRaw(base, cutoff, (getRaw(base, cutoff) + 1) % 256);
    expect(diffBlocks(base, next)).toEqual([cutoff.block]);
    const msgs = blocksToSysex(next, diffBlocks(base, next));
    expect(msgs).toHaveLength(1);
    expect(parseDt1(msgs[0]!)!.data).toEqual(next.blocks[cutoff.block]);
    expect(diffBlocks(base, base)).toEqual([]);
  });
});

describe("morph", () => {
  const a = synthetic(0);
  const b = synthetic(7);

  it("endpoints are exact", () => {
    expect(morph(a, b, 0)).toEqual(a);
    expect(morph(a, b, 1)).toEqual(b);
  });

  it("interpolates a u16 param as one value", () => {
    const cutoff = p("vcf_cutoff");
    const lo = setRaw(a, cutoff, 0x0f); // nibbles 0,15
    const hi = setRaw(b, cutoff, 0x30); // nibbles 3,0
    expect(getRaw(morph(lo, hi, 0.5), cutoff)).toBe(Math.round((0x0f + 0x30) / 2));
    expect(getRaw(morph(lo, hi, 0.25), cutoff)).toBe(Math.round(0x0f + (0x30 - 0x0f) * 0.25));
  });

  it("interpolates continuous u7 params", () => {
    const att = p("vca_attack");
    const lo = setRaw(a, att, 10);
    const hi = setRaw(b, att, 110);
    expect(getRaw(morph(lo, hi, 0.5), att)).toBe(60);
  });

  it("snaps switches and enums at 0.5", () => {
    const sw = p("vco_saw_sw");
    const lo = setRaw(a, sw, 0);
    const hi = setRaw(b, sw, 1);
    expect(getRaw(morph(lo, hi, 0.49), sw)).toBe(0);
    expect(getRaw(morph(lo, hi, 0.5), sw)).toBe(1);
    const dt = p("dist_type");
    const l2 = setRaw(a, dt, 2);
    const h2 = setRaw(b, dt, 20);
    expect(getRaw(morph(l2, h2, 0.4), dt)).toBe(2);
    expect(getRaw(morph(l2, h2, 0.6), dt)).toBe(20);
  });

  it("snaps EFX type, switch and button bytes but interpolates slots", () => {
    const lo = setEfxType(a, 1, 4);
    const hi = setEfxType(b, 1, 8);
    expect(getEfxType(morph(lo, hi, 0.49), 1)).toBe(4);
    expect(getEfxType(morph(lo, hi, 0.5), 1)).toBe(8);

    const tremolo = efxTypes(1)[4]!;
    const sw = tremolo.swOffset!;
    const btn = tremolo.buttons[3]!.offset;
    const depth = tremolo.slots[4]!.offset;
    const x = setEfxRaw(setEfxRaw(setEfxRaw(lo, 1, sw, 0), 1, btn, 0), 1, depth, 20);
    const y = setEfxRaw(setEfxRaw(setEfxRaw(hi, 1, sw, 1), 1, btn, 1), 1, depth, 80);
    const mid = morph(x, y, 0.3);
    expect(getEfxRaw(mid, 1, sw)).toBe(0);
    expect(getEfxRaw(mid, 1, btn)).toBe(0);
    expect(getEfxRaw(mid, 1, depth)).toBe(38);
    expect(getEfxRaw(morph(x, y, 0.5), 1, sw)).toBe(1);
  });

  it("snaps bytes no table describes", () => {
    // The CV-offset block has bytes (the odd offsets of the u16 pairs excluded) no param uses.
    const key = PATCH_BLOCKS[1]!.addr;
    const k = addrKey(key);
    const mapped = new Set(PARAMS.filter((q) => q.block === k).flatMap((q) => [q.offset, q.offset + 1]));
    const unmapped = Array.from({ length: PATCH_BLOCKS[1]!.size }, (_, i) => i).find((i) => !mapped.has(i));
    if (unmapped === undefined) return;
    const lo = { blocks: { ...a.blocks, [k]: a.blocks[k]!.map((_, i) => (i === unmapped ? 2 : 0)) } };
    const hi = { blocks: { ...b.blocks, [k]: b.blocks[k]!.map((_, i) => (i === unmapped ? 12 : 0)) } };
    expect(morph(lo, hi, 0.4).blocks[k]![unmapped]).toBe(2);
    expect(morph(lo, hi, 0.6).blocks[k]![unmapped]).toBe(12);
  });
});
