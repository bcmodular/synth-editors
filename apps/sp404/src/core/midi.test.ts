import { describe, expect, it } from "vitest";
import { busDiffMessages, controlChange, effectChangeMessages, fxOnMessage, knobMessage, type BusFx } from "./midi";

const cassette: BusFx = { fxId: 20, on: true, values: [10, 20, 30, 40, 50, 60] };

describe("SP-404 FX messages", () => {
  it("sends on the bus's channel and clamps values", () => {
    expect(controlChange(1, 16, 64)).toEqual([0xb0, 16, 64]);
    expect(controlChange(5, 16, 200)).toEqual([0xb4, 16, 127]);
    expect(controlChange(3, 16, -4)).toEqual([0xb2, 16, 0]);
    expect(fxOnMessage(2, true)).toEqual([0xb1, 19, 127]);
    expect(fxOnMessage(2, false)).toEqual([0xb1, 19, 0]);
  });

  it("maps a parameter index to its knob CC", () => {
    expect(knobMessage(1, 20, 3, 99)).toEqual([0xb0, 80, 99]);
    expect(knobMessage(1, 4, 3, 99)).toBeUndefined(); // Isolator has three parameters
  });

  it("selects an effect with CC 83 numbered per bus group, then ON/OFF, then the knobs", () => {
    expect(effectChangeMessages(1, cassette)).toEqual([
      [0xb0, 83, 20], [0xb0, 19, 127],
      [0xb0, 16, 10], [0xb0, 17, 20], [0xb0, 18, 30], [0xb0, 80, 40], [0xb0, 81, 50], [0xb0, 82, 60],
    ]);
    expect(effectChangeMessages(4, cassette)[0]).toEqual([0xb3, 83, 3]);
    expect(effectChangeMessages(5, cassette)[0]).toEqual([0xb4, 83, 14]);
  });

  it("sends nothing for an effect the bus can't load (Gt Amp Sim is INPUT FX only)", () => {
    expect(effectChangeMessages(1, { fxId: 46, on: true, values: [0, 0, 0, 0, 0, 0] })).toEqual([]);
    expect(effectChangeMessages(1, { fxId: 0, on: true, values: [] })).toEqual([]);
  });

  it("sends only what changed while the effect stays", () => {
    expect(busDiffMessages(1, cassette, cassette)).toEqual([]);
    expect(busDiffMessages(1, cassette, { ...cassette, on: false, values: [10, 21, 30, 40, 50, 0] })).toEqual([
      [0xb0, 19, 0], [0xb0, 17, 21], [0xb0, 82, 0],
    ]);
  });

  it("sends the whole block when the effect changes or the device state is unknown", () => {
    expect(busDiffMessages(2, undefined, cassette)).toHaveLength(8);
    expect(busDiffMessages(2, { fxId: 1, on: true, values: [] }, cassette)).toHaveLength(8);
  });
});
