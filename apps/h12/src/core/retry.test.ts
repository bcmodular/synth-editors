import { describe, expect, it } from "vitest";
import { retrying } from "./retry";

const noWait = async () => undefined;

describe("retrying", () => {
  it("tries again until the result is good", async () => {
    let n = 0;
    const got = await retrying(async () => ++n, (v) => v < 3, { tries: 5, waitMs: 0, isCancelled: () => false, wait: noWait });
    expect(got).toBe(3);
  });

  it("gives up after the last try, with its result", async () => {
    let n = 0;
    const got = await retrying(async () => ++n, () => true, { tries: 4, waitMs: 0, isCancelled: () => false, wait: noWait });
    expect(got).toBe(4);
  });

  it("stops when cancelled", async () => {
    let n = 0;
    const got = await retrying(async () => ++n, () => true, { tries: 9, waitMs: 0, isCancelled: () => n >= 2, wait: noWait });
    expect(got).toBe(2);
  });
});
