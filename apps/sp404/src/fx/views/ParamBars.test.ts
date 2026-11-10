import { describe, expect, it } from "vitest";
import { fitLabel } from "./ParamBars";

describe("fitLabel", () => {
  it("keeps a label that fits, else its first word, else a cut", () => {
    expect(fitLabel("LEVEL", 47)).toBe("LEVEL");
    expect(fitLabel("LOW FREQ", 40)).toBe("LOW");
    expect(fitLabel("RESONANCE", 40)).toBe("RESONAN");
  });
});
