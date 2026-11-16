import { describe, expect, it } from "vitest";
import { checkFirmware, identityRequest, parseIdentity, versionOf } from "./firmware";

describe("firmware", () => {
  it("asks with the Universal Identity Request", () => {
    expect(identityRequest()).toEqual([0xf0, 0x7e, 0x7f, 0x06, 0x01, 0xf7]);
  });

  it("reads a Roland Identity Reply, and nothing else", () => {
    const reply = [0xf0, 0x7e, 0x10, 0x06, 0x02, 0x41, 0x47, 0x04, 0x01, 0x00, 0x00, 0x05, 0x05, 0x02, 0xf7];
    expect(parseIdentity(reply)).toEqual({ family: 0x247, model: 1, revision: [0, 5, 5, 2] });
    expect(parseIdentity([...reply.slice(0, 5), 0x43, ...reply.slice(6)])).toBeUndefined(); // Yamaha
    expect(parseIdentity(reply.slice(0, 14))).toBeUndefined();
    expect(parseIdentity([0x90, 60, 100])).toBeUndefined();
  });

  it("reads the revision's digits as a version", () => {
    expect(versionOf([0, 5, 5, 2])).toBe("5.52");
    expect(versionOf([0, 0, 4, 0])).toBe("4.0");
    expect(versionOf([0, 0, 0, 5])).toBe("5.0");
    expect(versionOf([1, 2, 30, 4])).toBe("1.2.30.4");
    expect(versionOf([0, 0, 0, 0])).toBe("0");
  });

  it("knows the tested version, and the ones accepted", () => {
    expect(checkFirmware("5.52", []).kind).toBe("tested");
    expect(checkFirmware("5.60", []).kind).toBe("untested");
    expect(checkFirmware("5.60", ["5.60"]).kind).toBe("accepted");
  });
});
