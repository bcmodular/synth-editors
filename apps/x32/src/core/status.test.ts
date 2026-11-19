import { describe, expect, it } from "vitest";
import { deskProblems } from "./status";

const info = (model: string, firmware: string) => ({ version: "V2.07", server: "osc-server", model, firmware });

describe("deskProblems", () => {
  it("accepts an X32 Rack on 4.x", () => {
    expect(deskProblems(info("X32RACK", "4.06"))).toEqual([]);
  });

  it("flags another model and older or newer firmware", () => {
    expect(deskProblems(info("X32", "3.08"))).toEqual([
      "This is an X32, not an X32 Rack",
      "Firmware 3.08: the app was written for 4.x",
    ]);
    expect(deskProblems(info("X32RACK", ""))).toEqual(["Firmware unknown: the app was written for 4.x"]);
  });
});
