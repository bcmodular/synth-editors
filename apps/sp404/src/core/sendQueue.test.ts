import { describe, expect, it } from "vitest";
import { SendQueue } from "./sendQueue";

describe("SendQueue", () => {
  it("hands items out oldest first", () => {
    const q = new SendQueue<number>();
    q.put("a", 1);
    q.put("b", 2);
    expect([q.take(), q.take(), q.take()]).toEqual([1, 2, undefined]);
  });

  it("keeps only the latest item for a key, in the key's first place", () => {
    const q = new SendQueue<number>();
    q.put("level", 10);
    q.put("pan", 64);
    q.put("level", 90);
    expect(q.size).toBe(2);
    expect([q.take(), q.take()]).toEqual([90, 64]);
  });

  it("clears", () => {
    const q = new SendQueue<number>();
    q.put("a", 1);
    q.clear();
    expect(q.take()).toBeUndefined();
  });
});
