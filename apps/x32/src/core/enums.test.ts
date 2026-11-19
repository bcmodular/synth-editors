import { describe, expect, it } from "vitest";
import { colourName, fxSourceBus, insertSlot, outputBus, outputSource, tapName } from "./enums";

describe("desk enums", () => {
  it("names colours, inverted ones too", () => {
    expect(colourName(0)).toBe("OFF");
    expect(colourName(3)).toBe("YE");
    expect(colourName(9)).toBe("RDi");
  });

  it("names tap points", () => {
    expect(tapName(3)).toBe("pre");
    expect(tapName(4)).toBe("post");
  });

  it("maps FX sources, insert selections and outputs to buses and slots", () => {
    expect(fxSourceBus(0)).toBeNull();
    expect(fxSourceBus(5)).toBe(5);
    expect(fxSourceBus(17)).toBeNull();
    expect(insertSlot(0)).toBeNull();
    expect(insertSlot(1)).toBe(1);
    expect(insertSlot(8)).toBe(4); // FX4R
    expect(insertSlot(17)).toBeNull();
    expect(outputBus(outputSource(7))).toBe(7);
    expect(outputBus(1)).toBeNull();
    expect(outputBus(20)).toBeNull();
  });
});
