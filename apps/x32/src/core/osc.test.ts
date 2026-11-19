import { describe, expect, it } from "vitest";
import { blob, decodePacket, encodeBundle, encodeMessage, float, int, str } from "./osc";

const hex = (b: Uint8Array) => [...b].map((x) => x.toString(16).padStart(2, "0")).join(" ");

describe("encodeMessage", () => {
  it("pads the address and type tags to 4 bytes", () => {
    // "/info" + zero = 6 bytes → 8; "," + zero = 2 → 4.
    expect(hex(encodeMessage("/info"))).toBe("2f 69 6e 66 6f 00 00 00 2c 00 00 00");
  });

  it("adds a whole 4 bytes of zeros when the string fills its last word", () => {
    expect(encodeMessage("/abc").length).toBe(8 + 4);
  });

  it("writes ints and floats big-endian", () => {
    const bytes = encodeMessage("/ch/01/mix/fader", [float(0.75)]);
    expect(hex(bytes.slice(-4))).toBe("3f 40 00 00");
    expect(hex(encodeMessage("/x", [int(-2)]).slice(-4))).toBe("ff ff ff fe");
  });
});

describe("decodePacket", () => {
  it("round-trips every argument type", () => {
    const args = [int(1), float(0.5), str("Volca Kick"), blob(new Uint8Array([1, 2, 3, 4, 5]))];
    expect(decodePacket(encodeMessage("/ch/01/config/name", args))).toEqual([{ address: "/ch/01/config/name", args }]);
  });

  it("reads a message with no type tags as having no arguments", () => {
    const bytes = new Uint8Array([0x2f, 0x78, 0, 0]); // "/x"
    expect(decodePacket(bytes)).toEqual([{ address: "/x", args: [] }]);
  });

  it("flattens bundles in order", () => {
    const a = { address: "/a", args: [int(1)] };
    const b = { address: "/b", args: [str("two")] };
    expect(decodePacket(encodeBundle([a, b]))).toEqual([a, b]);
  });

  it("rejects truncated packets and unknown tags", () => {
    const bytes = encodeMessage("/x", [int(1)]);
    expect(() => decodePacket(bytes.slice(0, -2))).toThrow("truncated");
    expect(() => decodePacket(encodeMessage("/x").map((v, i) => (i === 5 ? 0x54 : v)))).toThrow();
  });

  it("decodes /info as the desk sends it", () => {
    const reply = encodeMessage("/info", [str("V2.07"), str("osc-server"), str("X32RACK"), str("4.06")]);
    expect(decodePacket(reply)[0]?.args.map((a) => a.value)).toEqual(["V2.07", "osc-server", "X32RACK", "4.06"]);
  });
});
