import { describe, expect, it } from "vitest";
import { memoryDesk, studioShared, TEST_PRESETS } from "../../e2e/studio";
import { chatAllowed, Operator } from "./operator";
import type { PlanContext } from "./planner";
import { loadPresetPlan } from "./presetPlanner";
import { inLibrary, parsePresets, searchPresets, families } from "./presets";
import { libraryNames } from "./library";

function setup() {
  const desk = memoryDesk();
  const presets = inLibrary(TEST_PRESETS, libraryNames((a) => desk.values.get(a)));
  const ctx: PlanContext = { get: (a) => desk.values.get(a), shared: studioShared, presets };
  return { desk, ctx, presets, op: new Operator(desk, chatAllowed(studioShared)) };
}

describe("the preset catalogue", () => {
  it("matches the library by name and searches by words", () => {
    const { presets } = setup();
    expect(presets.map((p) => p.index)).toEqual([0, 1, 2, 3, 4, null]);
    expect(searchPresets(presets, "gated snare")[0]!.name).toBe("Phil's Drums");
    expect(families({ code: "D/RV" })).toEqual(["delay", "reverb"]);
    expect(parsePresets({ presets: [{ name: "X", code: "HALL", slots: "1-8", extra: 1 }, { nope: true }] })).toEqual([
      { name: "X", type: "HALL", code: "HALL", slots: "1-8", description: "", tags: [] },
    ]);
  });
});

describe("loadPresetPlan", () => {
  it("loads a reverb into the reverb's slot, keeping its feed, after asking", () => {
    const plan = loadPresetPlan(setup().ctx, { preset: "big concert", target: "Reverb" });
    expect(plan.summary).toBe('Load "Big Concert" (Hall Reverb) into FX 1, replacing Hall Reverb (HALL)');
    expect(plan.load).toEqual({ name: "Big Concert", index: 0, slot: 1, code: "HALL" });
    expect(plan.changes.map((c) => [c.param.address, c.value])).toEqual([["/fx/1/source/l", 1], ["/fx/1/source/r", 2]]);
    expect(plan.confirm).toMatch(/can't be undone/);
  });

  it("keeps a send effect the kind it is (guard 3)", () => {
    expect(() => loadPresetPlan(setup().ctx, { preset: "Memory Man", target: "FX 1" })).toThrow("only takes another reverb preset");
  });

  it("puts a preset on a channel as an insert, in FX 5-8 when it fits there", () => {
    const { ctx } = setup();
    const plan = loadPresetPlan(ctx, { preset: "Squeezer", target: "TB-3" });
    expect(plan.load?.slot).toBe(8);
    expect(plan.summary).toBe('Put "Squeezer" (Precision Limiter) on TB-3 as an insert, in FX 8');
    const delay = loadPresetPlan(ctx, { preset: "Memory Man", target: "TD-3-MO" });
    expect(delay.summary).toBe('Put "Memory Man" (Stereo Delay) on TD-3-MO as an insert, in FX 4; FX 4 stops being fed by bus 7-8');
  });

  it("refuses a send reverb as an insert, a preset not on the desk, and an unknown one", () => {
    const { ctx } = setup();
    expect(() => loadPresetPlan(ctx, { preset: "Big Concert", target: "TD-3-MO" })).toThrow("send reverb with no dry signal");
    expect(() => loadPresetPlan(ctx, { preset: "Not On Desk", target: "FX 2" })).toThrow("isn't in the desk's FX library");
    expect(() => loadPresetPlan(ctx, { preset: "Moonbeam", target: "FX 2" })).toThrow('No preset named "Moonbeam"');
  });
});

describe("Operator with a preset load", () => {
  it("loads from the library, checks the type, and doesn't go on the undo stack", async () => {
    const { op, ctx, desk } = setup();
    await op.propose(loadPresetPlan(ctx, { preset: "Vocal Plate", target: "Reverb" }));
    const outcome = await op.confirm();
    expect(outcome?.kind).toBe("applied");
    expect(desk.writes[0]).toBe("/load libfx 1 0");
    expect(desk.values.get("/fx/1/type")).toBe(5); // PLAT
    expect(op.lastApplied).toBeNull();
  });

  it("reports a load that doesn't land as a mismatch, before any other write", async () => {
    const { op, ctx, desk } = setup();
    const plan = loadPresetPlan(ctx, { preset: "Vocal Plate", target: "Reverb" });
    await op.propose({ ...plan, load: { ...plan.load!, index: 2 } }); // a wrong index loads Memory Man, a delay
    const outcome = await op.confirm();
    expect(outcome?.kind).toBe("mismatch");
    expect(desk.writes.filter((w) => w.startsWith("/fx/1/source"))).toEqual([]);
  }, 10_000);
});
