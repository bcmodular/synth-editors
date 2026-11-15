import { describe, expect, it } from "vitest";
import { spreadTags } from "./envTags";

const row = { width: 40, gap: 4, left: 10, right: 222 };

describe("spreadTags", () => {
  it("centres each tag under its stage when there's room", () => {
    expect(spreadTags({ ...row, centres: [40, 100, 150, 200] })).toEqual([20, 80, 130, 180]);
  });

  it("pushes tags apart where stages are short", () => {
    expect(spreadTags({ ...row, centres: [10, 10, 60, 70] })).toEqual([10, 54, 98, 142]);
  });

  it("stays inside the graph at the right", () => {
    const xs = spreadTags({ ...row, centres: [150, 200, 215, 220] });
    expect(xs[3]).toBe(182);
    for (let i = 1; i < xs.length; i++) expect(xs[i]! - xs[i - 1]!).toBeGreaterThanOrEqual(44);
  });
});
