import { describe, expect, it } from "vitest";
import { firmwareOk, isHub, mapperFormatProblem, parseFirmware, parsePreset } from "./status";
import { firmwareAnswer, presetAnswer } from "./testFrames";

describe("parseFirmware", () => {
  it("reads the firmware, product ID and serial from a 30-byte answer", () => {
    const d = firmwareAnswer(0x47);
    expect(d).toHaveLength(30);
    expect(d[8]).toBe(19); // bytes 9 up to the checksum
    const f = parseFirmware(d)!;
    expect(f).toMatchObject({ major: 4, minor: 7, version: "4.7", productId: 0x26 });
    expect(f.serial).toBe("0102030405060708090A0B0C");
    expect(isHub(f)).toBe(true);
  });

  it("refuses a frame of the wrong length", () => {
    expect(parseFirmware(firmwareAnswer().slice(1))).toBeUndefined();
  });
});

describe("firmwareOk", () => {
  it("accepts 4.7 and later", () => {
    expect(firmwareOk({ major: 4, minor: 7 })).toBe(true);
    expect(firmwareOk({ major: 4, minor: 8 })).toBe(true);
    expect(firmwareOk({ major: 5, minor: 0 })).toBe(true);
    expect(firmwareOk({ major: 4, minor: 6 })).toBe(false);
    expect(firmwareOk({ major: 3, minor: 9 })).toBe(false);
  });
});

describe("mapperFormatProblem", () => {
  it("allows the 4.x mapper format only", () => {
    expect(mapperFormatProblem({ major: 4, version: "4.7" })).toBeUndefined();
    expect(mapperFormatProblem({ major: 5, version: "5.0" })).toContain("Firmware 5.0 stores mappers differently");
    expect(mapperFormatProblem(undefined)).toContain("unknown");
  });
});

describe("parsePreset", () => {
  it("reads the preset and the reload bit", () => {
    expect(parsePreset(presetAnswer(0))).toEqual({ index: 0, reload: false });
    expect(parsePreset(presetAnswer(0x80000001))).toEqual({ index: 1, reload: true });
  });
});
