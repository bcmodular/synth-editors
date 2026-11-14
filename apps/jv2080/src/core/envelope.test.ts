import { describe, expect, it } from "vitest";
import { envelopeLevel, envelopeNodes, rawAtLevel, type EnvelopeSpec } from "./envelope";

const amp: EnvelopeSpec = { times: [0, 48, 78, 36], levels: [127, 118, 21], levelMax: 127 };
const pitch: EnvelopeSpec = { times: [10, 20, 30, 40], levels: [126, 0, 63, 63], levelMax: 126, center: 63 };

describe("envelopes", () => {
  it("rises through the stages, holds L3 for the sustain, and the amp releases to 0", () => {
    expect(envelopeNodes(amp, 40)).toEqual([
      { t: 0, v: 0 }, { t: 0, v: 1 }, { t: 48, v: 118 / 127 }, { t: 126, v: 21 / 127 }, { t: 166, v: 21 / 127 },
      { t: 202, v: 0 },
    ]);
  });

  it("draws bipolar pitch levels round the centre", () => {
    expect(envelopeNodes(pitch, 0).map((n) => n.v)).toEqual([0, 1, -1, 0, 0, 0]);
    expect(envelopeLevel(pitch, 63)).toBe(0);
  });

  it("turns a drawn level back into a clamped raw value", () => {
    expect(rawAtLevel(pitch, -1)).toBe(0);
    expect(rawAtLevel(pitch, 0.5)).toBe(95);
    expect(rawAtLevel(amp, 2)).toBe(127);
    expect(rawAtLevel(amp, -0.2)).toBe(0);
  });
});
