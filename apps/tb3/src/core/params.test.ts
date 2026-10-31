import { describe, expect, it } from "vitest";
import { EFX_BLOCK, efxTypes } from "./efx";
import type { EfxNum } from "./efx";
import { GLOBAL_TUNING_DISPLAY, dispPitchSt, dispRatio, globalTuningCc } from "./display";
import { PARAMS, paramById } from "./params";
import { PATCH_BLOCKS, addrKey } from "./sysex";

const sizeOf = new Map(PATCH_BLOCKS.map((b) => [addrKey(b.addr), b.size]));

describe("param table", () => {
  it("has unique ids", () => {
    expect(new Set(PARAMS.map((p) => p.id)).size).toBe(PARAMS.length);
  });

  it("keeps every param inside its block, with no byte used twice", () => {
    const used = new Set<string>();
    for (const p of PARAMS) {
      const size = sizeOf.get(p.block);
      expect(size, p.id).toBeDefined();
      const width = p.encoding === "u16" ? 2 : 1;
      expect(p.offset + width, p.id).toBeLessThanOrEqual(size!);
      for (let i = 0; i < width; i++) {
        const k = `${p.block}:${p.offset + i}`;
        expect(used.has(k), `${p.id} overlaps at ${k}`).toBe(false);
        used.add(k);
      }
    }
  });

  it("assigns switches max 1 and gives every kind a display", () => {
    for (const p of PARAMS) {
      if (p.kind === "switch") expect(p.max, p.id).toBe(1);
      expect(typeof p.display(0), p.id).toBe("string");
    }
  });

  it("uses the spec's example ids", () => {
    for (const id of ["vcf_cutoff", "vco_saw_level", "vco_saw_sw", "lfo_bpm_sync"]) {
      expect(() => paramById(id)).not.toThrow();
    }
  });
});

describe("param display", () => {
  it("formats signed, bipolar, semitone range, switch and tuning", () => {
    expect(paramById("vco_lfo_depth").display(64)).toBe("+0");
    expect(paramById("vco_lfo_depth").display(0)).toBe("-64");
    expect(paramById("dist_bottom").display(50)).toBe("+0");
    expect(paramById("saw_tuning").display(127)).toBe("+0");
    expect(paramById("saw_tuning").max).toBe(151);
    expect(paramById("bender_range").display(23)).toBe("±24 st");
    expect(paramById("bender_range").display(0)).toBe("±1 st");
    expect(paramById("vco_saw_sw").display(1)).toBe("ON");
    expect(paramById("vcf_cutoff").display(200)).toBe("200");
  });

  it("names enums", () => {
    expect(paramById("dist_type").display(0)).toBe("Mid Boost");
    expect(paramById("dist_type").display(24)).toBe("MUFF FUZZ");
    expect(paramById("porta_mode").display(1)).toBe("ALWAYS");
  });

  it("resolves assign slots via assignId, falling back to #id", () => {
    const slot = paramById("assign_xy_mod");
    expect(slot.encoding).toBe("u16");
    expect(slot.display(54)).toBe("VCF CUTOFF");
    expect(slot.display(202)).toBe("#202");
  });

  it("has the global tuning table and CC builder", () => {
    expect(GLOBAL_TUNING_DISPLAY).toHaveLength(128);
    expect(GLOBAL_TUNING_DISPLAY[64]).toBe("+0.0st");
    expect(GLOBAL_TUNING_DISPLAY[127]).toBe("+7.0st");
    expect(globalTuningCc(1, 64)).toEqual([0xb1, 104, 64]);
  });
});

describe("EFX table", () => {
  it("has types 0–10 for EFX1 and 0–9 for EFX2", () => {
    expect(efxTypes(1)).toHaveLength(11);
    expect(efxTypes(2)).toHaveLength(10);
    expect(efxTypes(1)[9]!.name).toBe("PITCH SHIFT");
    expect(efxTypes(2)[9]!.name).toBe("REVERB");
  });

  it("keeps offsets inside the EFX block and bytes unique within a type", () => {
    for (const n of [1, 2] as EfxNum[]) {
      const size = sizeOf.get(EFX_BLOCK[n])!;
      for (const t of efxTypes(n)) {
        const offsets: number[] = [];
        if (t.swOffset !== undefined) offsets.push(t.swOffset);
        for (const s of t.slots) if (s) offsets.push(s.offset);
        const slotAndSw = new Set(offsets);
        expect(slotAndSw.size, `${n}:${t.name}`).toBe(offsets.length);
        for (const b of t.buttons) if (b) offsets.push(b.offset);
        for (const o of offsets) expect(o, `${n}:${t.name}`).toBeLessThan(size);
        for (const b of t.buttons) if (b) expect(slotAndSw.has(b.offset), `${t.name} ${b.name}`).toBe(false);
      }
    }
  });

  it("keeps slot offsets apart from every type's switch and button bytes", () => {
    // Morph interpolates all slot offsets in a block, so they must never be switch/button bytes.
    for (const n of [1, 2] as EfxNum[]) {
      const slots = new Set<number>();
      const others = new Set<number>([0]);
      for (const t of efxTypes(n)) {
        for (const s of t.slots) if (s) slots.add(s.offset);
        if (t.swOffset !== undefined) others.add(t.swOffset);
        for (const b of t.buttons) if (b) others.add(b.offset);
      }
      for (const o of others) expect(slots.has(o), `EFX${n} offset ${o}`).toBe(false);
    }
  });

  it("keeps null holes as layout positions", () => {
    const tremolo = efxTypes(1)[4]!;
    expect(tremolo.slots[2]).toBeNull();
    expect(tremolo.slots[3]).toBeNull();
    expect(tremolo.buttons.slice(0, 3)).toEqual([null, null, null]);
    expect(efxTypes(1)[10]!.slots[7]).toBeNull();
  });

  it("records defaults and disabledBy", () => {
    const phaser = efxTypes(2)[7]!;
    expect(phaser.slots[1]!.disabledBy).toEqual([0x37, 0x3b]);
    expect(efxTypes(1)[8]!.slots[6]!.default).toBe(1);
  });

  it("spot-checks display functions", () => {
    expect(dispRatio(13)).toBe("1:INF");
    expect(dispPitchSt(24)).toBe("+0 st");
    expect(dispPitchSt(0)).toBe("-24 st");
    const d = (n: EfxNum, type: number, slot: number, raw: number) => efxTypes(n)[type]!.slots[slot]!.display(raw);
    expect(d(1, 1, 0, 40)).toBe("0 dB"); // threshold
    expect(d(1, 1, 4, 0)).toBe("Hard");
    expect(d(1, 1, 4, 3)).toBe("Soft 3");
    expect(d(1, 1, 5, 40)).toBe("+0 dB");
    expect(d(1, 1, 2, 124)).toBe("800 ms");
    expect(d(1, 4, 0, 0)).toBe("OFF");
    expect(d(1, 4, 0, 10)).toBe("1/4");
    expect(d(1, 4, 1, 100)).toBe("20 ms");
    expect(d(1, 4, 1, 0)).toBe("8000 ms");
    expect(d(1, 4, 7, 50)).toBe("180°");
    expect(d(1, 5, 7, 0)).toBe("Flat");
    expect(d(1, 5, 8, 14)).toBe("Flat");
    expect(d(1, 6, 8, 10)).toBe("800 Hz");
    expect(d(1, 10, 4, 27)).toBe("10 kHz");
    expect(d(1, 10, 5, 5)).toBe("Q 16");
    expect(d(2, 9, 0, 99)).toBe("9.9 s");
    expect(d(1, 8, 4, 100)).toBe("100%");
    expect(d(1, 3, 4, 15)).toBe("+0 dB");
  });
});
