import { describe, expect, it } from "vitest";
import { addUsage, costOf, usageText, ZERO_USAGE } from "./usage";

describe("usage", () => {
  it("adds up and prices Haiku, cache reads at a tenth", () => {
    const u = addUsage(ZERO_USAGE, { input: 1000, output: 200, cacheRead: 10_000, cacheWrite: 0 });
    expect(costOf(u, "claude-haiku-5-5")).toBeCloseTo((1000 * 0.1 + 10_000 * 0.01 + 200 * 0.5) / 1e6, 10);
    expect(costOf(u, "some-other-model")).toBeNull();
    expect(usageText(u, "claude-haiku-5-5")).toBe("11,200 tokens, about $0.0003");
  });
});
