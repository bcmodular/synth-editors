import { describe, expect, it } from "vitest";
import { config, fx, insert, link, output, send, strip, stripPath } from "./addresses";

describe("addresses", () => {
  it("pads strip numbers to two digits", () => {
    expect(stripPath(strip("ch", 1))).toBe("/ch/01");
    expect(stripPath(strip("auxin", 5))).toBe("/auxin/05");
    expect(config(strip("bus", 11)).name).toEqual({ address: "/bus/11/config/name", type: "s" });
  });

  it("refuses strips the Rack doesn't have", () => {
    expect(() => strip("ch", 0)).toThrow();
    expect(() => strip("auxin", 9)).toThrow();
    expect(() => strip("bus", 1.5)).toThrow();
  });

  it("builds sends with their types", () => {
    const s = send(strip("auxin", 3), 11);
    expect(s.on).toEqual({ address: "/auxin/03/mix/11/on", type: "i" });
    expect(s.level).toEqual({ address: "/auxin/03/mix/11/level", type: "f" });
    expect(() => send(strip("bus", 1), 3)).toThrow();
    expect(() => send(strip("ch", 1), 17)).toThrow();
  });

  it("builds inserts, FX and outputs", () => {
    expect(insert(strip("ch", 15)).sel.address).toBe("/ch/15/insert/sel");
    expect(fx(4).type.address).toBe("/fx/4/type");
    expect(fx(2).source("r").address).toBe("/fx/2/source/r");
    expect(fx(2).par(3)).toEqual({ address: "/fx/2/par/03", type: "f" });
    expect(() => fx(9)).toThrow();
    expect(output("main", 1).address).toBe("/outputs/main/01/src");
  });

  it("finds the link for either side of a pair", () => {
    expect(link(strip("ch", 7)).address).toBe("/config/chlink/7-8");
    expect(link(strip("ch", 8)).address).toBe("/config/chlink/7-8");
    expect(link(strip("bus", 11)).address).toBe("/config/buslink/11-12");
    expect(link(strip("auxin", 4)).address).toBe("/config/auxlink/3-4");
  });
});
