import { describe, expect, it } from "vitest";
import { memoryDesk, studioShared } from "../../e2e/studio";
import { send, strip, stripOn } from "./addresses";
import { meterBlob, Peaks, readMeters } from "./meters";
import { blob } from "./osc";
import type { PlanContext } from "./planner";
import { banksOf, traceStages, traceText } from "./trace";

function setup() {
  const desk = memoryDesk();
  const ctx: PlanContext = { get: (a) => desk.values.get(a), shared: studioShared };
  return { desk, ctx };
}

// Meter banks as the desk would stream them: every value silent but those given.
function peaks(levels: Record<number, Record<number, number>>): Peaks {
  const p = new Peaks();
  for (const [bank, at] of Object.entries(levels)) {
    const values = Array.from({ length: 82 }, (_, i) => at[i] ?? 0);
    p.take({ address: `/meters/${bank}`, args: [blob(meterBlob(values))] });
  }
  return p;
}

describe("meters", () => {
  it("reads a bank's blob", () => {
    expect(readMeters({ address: "/meters/4", args: [blob(meterBlob([0.5, 1]))] })).toEqual({ bank: 4, values: [0.5, 1] });
    expect(readMeters({ address: "/ch/01/mix/on", args: [] })).toBeNull();
  });
});

describe("traceSignal", () => {
  it("follows TB-3 → Reverb → the FX 1 return, and the Sampler to its live output", () => {
    const { ctx } = setup();
    expect(traceStages(ctx, { source: "TB-3", destination: "Reverb" }).map((s) => s.name)).toEqual(["TB-3 (ch 7)", "bus 1 (Reverb)", "the FX 1 return"]);
    const sampler = traceStages(ctx, { source: "S-1", destination: "Sampler" });
    expect(sampler.map((s) => s.name)).toEqual(["S-1 (ch 9)", "bus 11 (the Sampler)", "XLR out 1"]);
    expect(banksOf(sampler)).toEqual([0, 4]);
  });

  it("says when it reaches the end", () => {
    const { ctx } = setup();
    const req = { source: "TB-3", destination: "Reverb" };
    expect(traceText(ctx, req, traceStages(ctx, req), peaks({ 0: { 6: 0.5, 48: 0.3, 40: 0.2 } }))).toBe(
      "The signal reaches the FX 1 return at -14 dBFS. If it still isn't heard, check the device it goes to.",
    );
  });

  it("points to the cable when nothing reaches the channel (acceptance 17)", () => {
    const { ctx } = setup();
    const req = { source: "TB-3", destination: "Reverb" };
    expect(traceText(ctx, req, traceStages(ctx, req), peaks({}))).toMatch(/^No level at TB-3 \(ch 7\) while it played: .*Check the cable/);
  });

  it("names the silent stage and the setting that explains it", () => {
    const { ctx, desk } = setup();
    desk.values.set(send(strip("ch", 7), 1).on.address, 0);
    desk.values.set(stripOn(strip("ch", 8)).address, 0);
    const req = { source: "TB-3", destination: "Reverb" };
    expect(traceText(ctx, req, traceStages(ctx, req), peaks({ 0: { 6: 0.5 } }))).toBe(
      "TB-3 (ch 7) has level (-6 dBFS), but bus 1 (Reverb) is silent. The settings say why: ch 8 is muted; ch 7's send to bus 1 is off.",
    );
  });
});
