import { describe, expect, it } from "vitest";
import { ALL, hasInit, MapperMessage, mapperWords, only } from "./mapper";

describe("mapperWords", () => {
  it("maps Note On channel 1 on MIDI In 3 to channel 2, following both values", () => {
    const words = mapperWords({
      input: { message: MapperMessage.noteOn, channel: 0, value1: ALL, value2: ALL },
      output: { message: MapperMessage.noteOn, channel: 1, value1: ALL, value2: ALL },
      follow1: true, follow2: true, midiIn: 3,
    });
    // Word 5 as HxMIDI Tools sets it for MIDI In 3.
    expect(words).toEqual([0x7f007f00, 0x7f007f00, 0x01000000, 0x5a000006, 0, 1 << 26]);
    expect(hasInit(words)).toBe(true);
  });

  it("maps CC 11 on MIDI In 2 to CC 74 on channel 6, following value 2 only", () => {
    const words = mapperWords({
      input: { message: MapperMessage.cc, channel: 0, value1: only(11), value2: ALL },
      output: { message: MapperMessage.cc, channel: 5, value1: only(74), value2: ALL },
      follow1: false, follow2: true, midiIn: 2,
    });
    expect(words[0]).toBe(0x0b0b7f00);
    expect(words[1]).toBe(0x4a4a7f00);
    expect(words[2]).toBe(0x05200002); // in CC ch 1, out CC (2 << 20) ch 6 (5 << 24)
    expect(words[3]).toBe(0x5a000004); // 5A: the init byte firmware 4.x needs
    expect(words[5]).toBe(1 << 25);
  });

  it("puts the output channel in bits 27–24 and the message in 23–20", () => {
    const words = mapperWords({
      input: { message: MapperMessage.pitchBend, channel: 0, value1: ALL, value2: ALL },
      output: { message: MapperMessage.pitchBend, channel: 15, value1: ALL, value2: ALL },
      follow1: true, follow2: true, midiIn: 3,
    });
    expect((words[2]! >>> 24) & 0x0f).toBe(15);
    expect((words[2]! >>> 20) & 0x0f).toBe(MapperMessage.pitchBend);
    expect(words[2]! & 0x0f).toBe(MapperMessage.pitchBend);
  });

  it("knows the init byte, as on the H12's factory mappers", () => {
    expect(hasInit([0x7f007f00, 0x7f007f00, 0x00f00f0f, 0x5a000187, 0, 0])).toBe(true);
    expect(hasInit([0, 0, 0, 0x05000006, 0, 0])).toBe(false); // the 5.0 format: resets 4.7 at power-up
    expect(hasInit([0, 0, 0, 0, 0, 0])).toBe(false);
  });
});
