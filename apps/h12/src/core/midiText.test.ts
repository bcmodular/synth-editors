import { describe as group, expect, it } from "vitest";
import { describe, isTicker, noteName } from "./midiText";

group("describe", () => {
  it("names notes with middle C as C3", () => {
    expect(noteName(60)).toBe("C3 (60)");
    expect(noteName(0)).toBe("C-2 (0)");
    expect(noteName(61)).toBe("C#3 (61)");
  });

  it("describes channel messages, with the channel 1-based", () => {
    expect(describe([0x91, 60, 100])).toEqual({ channel: 2, text: "Note On C3 (60) vel 100" });
    expect(describe([0x91, 60, 0])).toEqual({ channel: 2, text: "Note Off C3 (60)" });
    expect(describe([0x80, 62, 64])).toEqual({ channel: 1, text: "Note Off D3 (62) vel 64" });
    expect(describe([0xb5, 74, 12])).toEqual({ channel: 6, text: "CC 74 = 12" });
    expect(describe([0xcf, 0])).toEqual({ channel: 16, text: "Program 1" });
    expect(describe([0xd0, 90])).toEqual({ channel: 1, text: "Channel AT 90" });
    expect(describe([0xa0, 60, 5])).toEqual({ channel: 1, text: "Key AT C3 (60) 5" });
  });

  it("describes pitch bend from the centre", () => {
    expect(describe([0xe1, 0x00, 0x40]).text).toBe("Pitch Bend 0");
    expect(describe([0xe1, 0x7f, 0x7f]).text).toBe("Pitch Bend +8191");
    expect(describe([0xe1, 0x00, 0x00]).text).toBe("Pitch Bend -8192");
  });

  it("describes system messages", () => {
    expect(describe([0xf8])).toEqual({ text: "Clock" });
    expect(describe([0xfa])).toEqual({ text: "Start" });
    expect(describe([0xf0, 0x7e, 0x7f, 0x06, 0x01, 0xf7])).toEqual({ text: "SysEx, 6 bytes" });
    expect(describe([0xf9])).toEqual({ text: "F9" });
  });

  it("knows the messages that tick", () => {
    expect(isTicker([0xf8])).toBe(true);
    expect(isTicker([0xfe])).toBe(true);
    expect(isTicker([0xfa])).toBe(false);
  });
});
