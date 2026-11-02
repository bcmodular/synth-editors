import { describe, expect, it } from "vitest";
import { EQ_FREQS, HPF_FREQS, LPF_FREQS } from "./display";
import { eqGainDb, eqResponse, parseHz, SHELF_HZ } from "./eqResponse";
import type { EqSettings } from "./eqResponse";

// Cuts off, every gain at 0 dB, mids at 100 Hz / 1 kHz with Q 1.0.
const flat: EqSettings = {
  lowCut: 0,
  lowGain: 20,
  lmFreq: EQ_FREQS.indexOf("100 Hz"),
  lmQ: 1,
  lmGain: 20,
  hmFreq: EQ_FREQS.indexOf("1 kHz"),
  hmQ: 1,
  hmGain: 20,
  hiCut: LPF_FREQS.indexOf("Flat"),
  hiGain: 20,
  level: 20,
};

describe("eqResponse", () => {
  it("parses the display tables' frequencies", () => {
    expect(parseHz("1.25 kHz")).toBe(1250);
    expect(parseHz("20 Hz")).toBe(20);
    expect(parseHz("Flat")).toBeNull();
    expect(EQ_FREQS.every((f) => parseHz(f) !== null)).toBe(true);
  });

  it("is flat at 0 dB with every gain centred and the cuts off", () => {
    for (const y of eqResponse(flat, 40)) expect(y).toBeCloseTo(0, 6);
  });

  it("peaks a mid band by its gain at its frequency", () => {
    expect(eqGainDb({ ...flat, hmGain: 32 }, 1000)).toBeCloseTo(12, 1);
    expect(eqGainDb({ ...flat, lmGain: 8 }, 100)).toBeCloseTo(-12, 1);
    expect(Math.abs(eqGainDb({ ...flat, hmGain: 32 }, 50))).toBeLessThan(0.5);
  });

  it("narrows the peak as Q rises", () => {
    const wide = eqGainDb({ ...flat, hmGain: 32, hmQ: 0 }, 2000);
    const narrow = eqGainDb({ ...flat, hmGain: 32, hmQ: 5 }, 2000);
    expect(wide).toBeGreaterThan(narrow);
  });

  it("shelves the lows and highs", () => {
    expect(eqGainDb({ ...flat, lowGain: 30 }, 20)).toBeGreaterThan(9);
    expect(eqGainDb({ ...flat, lowGain: 30 }, SHELF_HZ.low * 20)).toBeCloseTo(0, 0);
    expect(eqGainDb({ ...flat, hiGain: 10 }, 20000)).toBeLessThan(-8);
  });

  it("cuts 3 dB at the cut frequency, 12 dB per octave beyond", () => {
    const lowCut = HPF_FREQS.indexOf("200 Hz");
    expect(eqGainDb({ ...flat, lowCut }, 200)).toBeCloseTo(-3, 0);
    expect(eqGainDb({ ...flat, lowCut }, 50)).toBeCloseTo(-24, 0);
    const hiCut = LPF_FREQS.indexOf("2 kHz");
    expect(eqGainDb({ ...flat, hiCut }, 2000)).toBeCloseTo(-3, 0);
  });

  it("adds the output level", () => {
    expect(eqGainDb({ ...flat, level: 26 }, 1000)).toBeCloseTo(6, 6);
  });
});
