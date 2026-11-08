import { describe, expect, it } from "vitest";
import { diffRuns, setRaw } from "../core/patch";
import type { Patch } from "../core/patch";
import { paramById } from "../core/params";
import { demoPatch } from "./demoPatch";
import { emptyBucket, pumpStep } from "./morphPump";

// Continuous params in different blocks, so each change is its own byte run.
const IDS = ["vcf_cutoff", "lfo_rate", "vco_saw_level", "master_volume"];
const shift = (p: Patch, by: number): Patch =>
  IDS.reduce((q, id) => setRaw(q, paramById(id), (by * 3 + 1) % 100), p);

const from = demoPatch();
const target = shift(from, 7);
const bytes = (p: Patch, q: Patch) => diffRuns(p, q).reduce((n, r) => n + r.data.length, 0);

describe("morph pump", () => {
  it("is done straight away when the TB-3 already holds the target", () => {
    const step = pumpStep(target, target, emptyBucket(0), { rate: 100, now: 0 });
    expect(step).toMatchObject({ runs: [], sent: target, done: true });
  });

  it("sends nothing with an empty bucket", () => {
    const step = pumpStep(from, target, emptyBucket(0), { rate: 100, now: 0 });
    expect(step.runs).toEqual([]);
    expect(step.sent).toBe(from);
    expect(step.done).toBe(false);
  });

  it("sends everything once the bucket has refilled enough", () => {
    const step = pumpStep(from, target, emptyBucket(0), { rate: 500, now: 1000 });
    expect(step.sent).toEqual(target);
    expect(step.bucket.tokens).toBe(100 - bytes(from, target)); // capped at 0.2 s of budget
    expect(pumpStep(step.sent, target, step.bucket, { rate: 500, now: 1000 }).done).toBe(true);
  });

  it("sends only what the rate allows, and gets there over several ticks", () => {
    let bucket = emptyBucket(0);
    let sent = from;
    let ticks = 0;
    for (let now = 20; !pumpStep(sent, target, bucket, { rate: 10, now }).done; now += 20) {
      const step = pumpStep(sent, target, bucket, { rate: 10, now });
      sent = step.sent;
      bucket = step.bucket;
      ticks++;
    }
    expect(sent).toEqual(target);
    expect(ticks).toBeGreaterThan(IDS.length); // 10 bytes/s at 20 ms ticks: one run at a time at most
  });

  it("rotates through the byte runs so one busy param doesn't starve the others", () => {
    const first = pumpStep(from, target, emptyBucket(0), { rate: 10, now: 200 });
    expect(first.runs.length).toBeGreaterThan(0);
    expect(first.runs.length).toBeLessThan(IDS.length);
    // Say the param first sent changed again before the next tick: the next tick still starts
    // with the runs that haven't gone yet.
    const again = pumpStep(from, target, first.bucket, { rate: 10, now: 400 });
    expect(first.runs).not.toContainEqual(again.runs[0]);
  });
});
