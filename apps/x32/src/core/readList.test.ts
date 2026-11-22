import { describe, expect, it } from "vitest";
import { deskReadList } from "./readList";
import { readAll } from "./reader";

describe("deskReadList", () => {
  const list = deskReadList().map((p) => p.address);

  it("covers names, links, sends, inserts, FX and outputs", () => {
    for (const a of ["/ch/01/config/name", "/bus/16/config/color", "/config/chlink/1-2", "/config/buslink/15-16",
      "/auxin/08/mix/16/on", "/fxrtn/01/mix/01/level", "/ch/32/mix/15/type", "/ch/15/insert/sel",
      "/fx/8/type", "/fx/4/source/r", "/outputs/main/08/src", "/outputs/aux/06/src"]) {
      expect(list).toContain(a);
    }
  });

  it("reads each address once, and no bus sends or bus inserts", () => {
    expect(new Set(list).size).toBe(list.length);
    expect(list.some((a) => a.startsWith("/bus/") && a.includes("/mix/"))).toBe(false);
    expect(list.some((a) => a.startsWith("/fxrtn/") && a.includes("/insert/"))).toBe(false);
  });

  it("skips what the X32 Rack doesn't have: aux inserts, even-bus tap points, FX 5-8 feeds", () => {
    expect(list.some((a) => a.startsWith("/auxin/") && a.includes("/insert/"))).toBe(false);
    expect(list).not.toContain("/ch/01/mix/02/type");
    expect(list).not.toContain("/fx/5/source/l");
  });

  it("reads names before sends, so the panel fills in a useful order", () => {
    expect(list.indexOf("/bus/16/config/name")).toBeLessThan(list.indexOf("/ch/01/mix/01/on"));
  });
});

describe("readAll", () => {
  const params = ["/a", "/b", "/c", "/d"].map((address) => ({ address, type: "i" as const }));

  it("reads everything, reports progress and lists what went unanswered", async () => {
    const seen: number[] = [];
    const result = await readAll(
      { read: async (p) => (p.address === "/c" ? Promise.reject(new Error("timeout")) : 1) },
      params,
      (p) => seen.push(p.done),
    );
    expect(result).toEqual({ done: 4, total: 4, missing: ["/c"] });
    expect(seen.at(-1)).toBe(4);
  });

  it("keeps no more than 16 reads in flight", async () => {
    let inFlight = 0;
    let most = 0;
    const many = Array.from({ length: 100 }, (_, i) => ({ address: `/x/${i}`, type: "i" as const }));
    await readAll({
      read: async () => {
        most = Math.max(most, ++inFlight);
        await new Promise((r) => setTimeout(r, 1));
        inFlight--;
        return 0;
      },
    }, many);
    expect(most).toBe(16);
  });

  it("stops when aborted", async () => {
    const abort = new AbortController();
    abort.abort();
    expect((await readAll({ read: async () => 0 }, params, undefined, abort.signal)).done).toBe(0);
  });
});
