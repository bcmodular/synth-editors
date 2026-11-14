import { describe, expect, it } from "vitest";
import { EFX_PARAM_COUNT, EFX_TYPES, efxDisplay, efxParamMax, efxParamOffset } from "./efx";
import { ALL_PARAMS, COMMON_PARAMS, TONE_PARAMS } from "./params";
import { param, paramWidth } from "./paramValue";
import { COMMON_SIZE, TONE_SIZE } from "./patch";
import { waveCount, waveGroupBytes, waveGroupOf, waveLabel, waveName } from "./waves";

describe("parameter table", () => {
  it("has unique ids and offsets that fit their block without overlapping", () => {
    expect(new Set(ALL_PARAMS.map((p) => p.id)).size).toBe(ALL_PARAMS.length);
    for (const [params, size] of [[COMMON_PARAMS, COMMON_SIZE], [TONE_PARAMS, TONE_SIZE]] as const) {
      const used = new Set<number>();
      for (const p of params) {
        for (let i = 0; i < paramWidth(p); i++) {
          expect(used.has(p.offset + i), p.id).toBe(false);
          used.add(p.offset + i);
        }
        expect(p.offset + paramWidth(p), p.id).toBeLessThanOrEqual(size);
        expect(p.min, p.id).toBeLessThanOrEqual(p.max);
      }
    }
  });

  it("labels every raw value of an enum", () => {
    for (const p of ALL_PARAMS.filter((q) => q.labels)) expect(p.labels!.length, p.id).toBe(p.max - p.min + 1);
  });

  it("displays as the panel does", () => {
    expect(param("coarseTune").display(36)).toBe("-12");
    expect(param("coarseTune").display(60)).toBe("+12");
    expect(param("pitchEnvLevel1").display(63)).toBe("0");
    expect(param("tonePan").display(0)).toBe("L64");
    expect(param("tonePan").display(64)).toBe("0");
    expect(param("tonePan").display(127)).toBe("63R");
    expect(param("bendDown").display(24)).toBe("-24");
    expect(param("octaveShift").display(3)).toBe("0");
    expect(param("waveNumber").display(0)).toBe("001");
    expect(param("reverbHfDamp").display(17)).toBe("BYPASS");
    expect(param("efxType").display(13)).toBe("14: STEREO-CHORUS");
  });

  it("throws for an unknown id", () => {
    expect(() => param("nope")).toThrow(/nope/);
  });
});

describe("EFX types", () => {
  it("has 40 types of at most 12 parameters, at Common 13–24", () => {
    expect(EFX_TYPES).toHaveLength(40);
    expect(Math.max(...EFX_TYPES.map((t) => t.params.length))).toBeLessThanOrEqual(EFX_PARAM_COUNT);
    expect(efxParamOffset(0)).toBe(13);
    expect(efxParamOffset(11)).toBe(24);
  });

  it("matches the manual's list for a type with every kind of parameter", () => {
    const eq = EFX_TYPES[0]!;
    expect(eq.name).toBe("STEREO-EQ");
    expect(eq.params.map((p) => p.name)).toEqual(
      ["Low Freq", "Low Gain", "P1 Freq", "P1 Gain", "P1 Q", "High Freq", "High Gain", "P2 Freq", "P2 Gain", "P2 Q", "Level"]);
    const [lowFreq, lowGain, p1Freq] = eq.params;
    expect(efxDisplay(lowFreq!, 1)).toBe("400 Hz");
    expect(efxParamMax(p1Freq!)).toBe(16);
    expect(lowGain!.kind).toBe("unknown");
    expect(efxDisplay(lowGain!, 40)).toBe("40");
  });

  it("puts BYPASS last in HF Damp lists", () => {
    const damp = EFX_TYPES[23]!.params.find((p) => p.name === "HF Damp")!; // REVERB
    expect(damp.labels).toHaveLength(18);
    expect(damp.labels!.at(-1)).toBe("BYPASS");
  });
});

describe("waves", () => {
  it("has 255 INT-A and 193 INT-B names", () => {
    expect(waveCount("INT-A")).toBe(255);
    expect(waveCount("INT-B")).toBe(193);
    expect(waveName("INT-A", 0)).toBe("Ac Piano1 A");
    expect(waveName("INT-A", 254)).toBe("Vox Noise");
    expect(waveName("INT-B", 192)).toBe("DC");
  });

  it("maps groups to the bytes found on the JV (type 0, ID 1 / 2)", () => {
    expect(waveGroupBytes("INT-B")).toEqual([0, 2]);
    expect(waveGroupOf(0, 1)).toBe("INT-A");
    expect(waveGroupOf(2, 1)).toBeUndefined();
    expect(waveLabel(0, 1, 9)).toBe("INT-A 010 Piano Thump");
    expect(waveLabel(2, 3, 0)).toBe("group 2/3 001");
  });
});
