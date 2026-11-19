import { describe, expect, it, vi } from "vitest";
import { DeskCache } from "./cache";
import { blob, float, int, str } from "./osc";

describe("DeskCache", () => {
  it("takes single-value messages and reports changes once", () => {
    const cache = new DeskCache();
    const seen = vi.fn();
    cache.onChange(seen);
    expect(cache.take({ address: "/ch/01/mix/03/level", args: [float(0.5)] })).toBe(true);
    cache.take({ address: "/ch/01/mix/03/level", args: [float(0.5)] });
    cache.take({ address: "/ch/01/config/name", args: [str("Volca Kick")] });
    expect(cache.get("/ch/01/mix/03/level")).toBe(0.5);
    expect(seen.mock.calls).toEqual([["/ch/01/mix/03/level", 0.5], ["/ch/01/config/name", "Volca Kick"]]);
  });

  it("leaves /info, /node, blobs and multi-value messages alone", () => {
    const cache = new DeskCache();
    expect(cache.take({ address: "/info", args: [str("V2.07")] })).toBe(false);
    expect(cache.take({ address: "node", args: [str("/ch/01/config ...")] })).toBe(false);
    expect(cache.take({ address: "/meters/1", args: [blob(new Uint8Array(4))] })).toBe(false);
    expect(cache.take({ address: "/x", args: [int(1), int(2)] })).toBe(false);
    expect(cache.take({ address: "/x", args: [] })).toBe(false);
    expect(cache.size).toBe(0);
  });

  it("stops telling a listener once it unsubscribes, and clears", () => {
    const cache = new DeskCache();
    const seen = vi.fn();
    const off = cache.onChange(seen);
    off();
    cache.set("/a", 1);
    expect(seen).not.toHaveBeenCalled();
    cache.clear();
    expect(cache.entries()).toEqual([]);
  });
});
