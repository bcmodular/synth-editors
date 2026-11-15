import { describe, expect, it } from "vitest";
import { knobArc } from "./knobArc";

describe("knobArc", () => {
  it("sweeps 270° from the bottom left", () => {
    expect(knobArc({ value: 0, max: 127 })).toEqual({ pointer: -135, from: -135, length: 0 });
    expect(knobArc({ value: 127, max: 127 })).toEqual({ pointer: 135, from: -135, length: 270 });
  });

  it("runs a bipolar value's arc from its centre, either way", () => {
    expect(knobArc({ value: 64, max: 128, center: 64 })).toEqual({ pointer: 0, from: 0, length: 0 });
    expect(knobArc({ value: 96, max: 128, center: 64 })).toEqual({ pointer: 67.5, from: 0, length: 67.5 });
    expect(knobArc({ value: 32, max: 128, center: 64 })).toEqual({ pointer: -67.5, from: -67.5, length: 67.5 });
  });

  it("keeps out-of-range values on the dial", () => {
    expect(knobArc({ value: 200, max: 127 }).pointer).toBe(135);
  });
});
