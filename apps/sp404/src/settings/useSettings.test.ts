import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, readSettings } from "./useSettings";

describe("readSettings", () => {
  it("falls back to the defaults (Mode B, channel 1, no offset)", () => {
    expect(readSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(readSettings("not json")).toEqual(DEFAULT_SETTINGS);
    expect(DEFAULT_SETTINGS.padMidi).toEqual({ mode: "B", baseChannel: 1, noteOffset: 0 });
  });

  it("keeps valid values and clamps the rest", () => {
    const raw = JSON.stringify({ padMidi: { mode: "A", baseChannel: 12, noteOffset: -40 } });
    expect(readSettings(raw).padMidi).toEqual({ mode: "A", baseChannel: 9, noteOffset: -12 });
    expect(readSettings(JSON.stringify({ padMidi: { mode: "C", baseChannel: 2.5 } })).padMidi)
      .toEqual({ mode: "B", baseChannel: 1, noteOffset: 0 });
  });
});
