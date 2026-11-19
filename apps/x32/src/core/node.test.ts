import { describe, expect, it } from "vitest";
import { parseNodeLine } from "./node";

describe("parseNodeLine", () => {
  it("splits the path and values, keeping quoted spaces", () => {
    expect(parseNodeLine('/ch/01/config "Volca Kick" 1 YE 1\n')).toEqual({
      path: "/ch/01/config", values: ["Volca Kick", "1", "YE", "1"],
    });
  });

  it("keeps empty quoted values", () => {
    expect(parseNodeLine('/ch/15/config "" 1 OFF 15')?.values).toEqual(["", "1", "OFF", "15"]);
  });

  it("rejects text that isn't a node line", () => {
    expect(parseNodeLine("")).toBeNull();
    expect(parseNodeLine("ch/01/config 1")).toBeNull();
  });
});
