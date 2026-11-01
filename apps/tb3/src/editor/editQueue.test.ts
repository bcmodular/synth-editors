import { describe, expect, it } from "vitest";
import { createEditQueue } from "./editQueue";

describe("edit queue", () => {
  it("sends the last message per key once per tick", () => {
    const sent: number[][] = [];
    const ticks: (() => void)[] = [];
    const q = createEditQueue((m) => sent.push(m), (f) => ticks.push(f));
    q.push("vcf_cutoff", [1]);
    q.push("vcf_cutoff", [2]);
    q.push("vcf_resonance", [3]);
    expect(ticks).toHaveLength(1);
    expect(sent).toEqual([]);
    ticks[0]!();
    expect(sent).toEqual([[2], [3]]);
    q.push("vcf_cutoff", [4]);
    expect(ticks).toHaveLength(2);
    ticks[1]!();
    expect(sent).toEqual([[2], [3], [4]]);
  });
});
