import { describe, expect, it } from "vitest";
import { studioDesk, studioRig, studioShared } from "../../e2e/studio";
import type { DeskValue } from "./cache";
import { fromDesk, EFFECTS, toDesk, typeName, typeValue } from "./effects";
import { insertFx, removeInsert, setFxParam, setFxType } from "./fxPlanner";
import type { Plan, PlanContext } from "./planner";

function desk(): PlanContext & { values: Map<string, DeskValue>; apply: (p: Plan) => void } {
  const values = new Map([...studioDesk()].map(([a, arg]) => [a, arg.value as DeskValue]));
  return {
    values, get: (a) => values.get(a), shared: studioShared, feeds: studioRig.fx,
    apply: (p) => p.changes.forEach((c) => values.set(c.param.address, c.value)),
  };
}

const writes = (p: Plan) => Object.fromEntries(p.changes.map((c) => [c.param.address, c.value]));

describe("effects tables", () => {
  it("names types per slot range and scales parameters both ways", () => {
    expect(typeName({ slot: 1, value: 10 })).toBe("Stereo Delay (DLY)");
    expect(typeName({ slot: 5, value: 0 })).toBe("Dual GEQ (GEQ2)");
    expect([typeValue({ slot: 1 }, "dly"), typeValue({ slot: 1 }, "Stereo Delay"), typeValue({ slot: 5 }, "DLY")]).toEqual([10, 10, null]);
    const time = EFFECTS.DLY!.params[1]!;
    expect(toDesk({ def: time, value: 250 })).toBeCloseTo(249 / 2999, 6);
    expect(fromDesk(time, toDesk({ def: time, value: 250 }))).toBe("250 ms");
    const decay = EFFECTS.HALL!.params[1]!;
    expect(fromDesk(decay, toDesk({ def: decay, value: 2.5 }))).toBe("2.5 s");
    expect(toDesk({ def: EFFECTS.DLY!.params[3]!, value: "3/2" })).toBe(6);
    expect(() => toDesk({ def: EFFECTS.DLY!.params[2]!, value: "wide" })).toThrow("Mode takes ST, X, M");
  });
});

describe("insertFx", () => {
  it("puts a delay on the TD-3 in the highest free slot, after asking (acceptance 5, without the tempo)", () => {
    const ctx = desk();
    const plan = insertFx(ctx, { source: "TD-3-MO", effect: "DLY" });
    expect(plan.summary).toBe("Put Stereo Delay (DLY) on TD-3-MO as an insert, in FX 4; FX 4 stops being fed by bus 7-8");
    expect(plan.confirm).not.toBeNull();
    const w = writes(plan);
    expect(w).toMatchObject({ "/fx/4/source/l": 0, "/fx/4/type": 10, "/fx/4/par/03": 0, "/fx/4/par/04": 6, "/ch/03/insert/sel": 7, "/ch/03/insert/on": 1 });
    expect(w["/fx/4/par/01"]).toBeCloseTo(0.3, 6); // mix 30 %
    expect(plan.changes.map((c) => c.step)).toEqual([...plan.changes.map((c) => c.step)].sort());
  });

  it("puts a stereo source's sides on the effect's two sides", () => {
    const w = writes(insertFx(desk(), { source: "TB-3", effect: "Stereo Chorus" }));
    expect([w["/ch/07/insert/sel"], w["/ch/08/insert/sel"]]).toEqual([7, 8]);
  });

  it("refuses what can't be an insert", () => {
    expect(() => insertFx(desk(), { source: "TD-3-MO", effect: "HALL" })).toThrow("has no dry/wet mix");
    expect(() => insertFx(desk(), { source: "Reverb Rtn", effect: "DLY" })).toThrow("only channels have an insert point");
    expect(() => insertFx(desk(), { source: "TD-3-MO", effect: "Rotary Speaker" })).toThrow("doesn't know");
    const ctx = desk();
    ctx.apply(insertFx(ctx, { source: "TD-3-MO", effect: "DLY" }));
    expect(() => insertFx(ctx, { source: "TD-3-MO", effect: "CRS" })).toThrow("already has FX 4");
  });

  it("never takes a send effect, and says so when none is left", () => {
    const ctx = desk();
    for (const src of ["TD-3-MO", "Volca Bass", "S-1"]) ctx.apply(insertFx(ctx, { source: src, effect: "DLY" }));
    expect(ctx.values.get("/fx/1/type")).toBe(0); // FX 1 (Reverb) is a send effect: the TB-3 is sent to it
    expect(() => insertFx(ctx, { source: "JV-2080", effect: "DLY" })).toThrow("No free FX slot");
  });
});

describe("removeInsert", () => {
  it("takes the insert off and feeds the slot from its bus again", () => {
    const ctx = desk();
    ctx.apply(insertFx(ctx, { source: "TD-3-MO", effect: "DLY" }));
    const plan = removeInsert(ctx, { source: "TD-3-MO" });
    expect(plan.summary).toBe("Take FX 4 off TD-3-MO, and feed it from bus 7-8 again");
    expect(writes(plan)).toMatchObject({ "/ch/03/insert/on": 0, "/ch/03/insert/sel": 0, "/fx/4/source/l": 7, "/fx/4/source/r": 8 });
    expect(() => removeInsert(ctx, { source: "S-1" })).toThrow("S-1 has no insert");
  });
});

describe("setFxParam and setFxType", () => {
  it("sets a parameter by the bus that feeds the slot, straight away", () => {
    const plan = setFxParam(desk(), { target: "Reverb", param: "decay", value: 2.5 });
    expect(plan.summary).toBe("Set FX 1 (Hall Reverb (HALL)) Decay to 2.5 s");
    expect(plan.confirm).toBeNull();
    expect(plan.changes[0]!.tolerance).toBeGreaterThan(0);
  });

  it("leaves a synced delay's time to the tempo", () => {
    const ctx = desk();
    ctx.apply(insertFx(ctx, { source: "TD-3-MO", effect: "DLY" }));
    expect(() => setFxParam(ctx, { target: "TD-3-MO", param: "Time", value: 300 })).toThrow("follows the tempo");
    expect(writes(setFxParam(ctx, { target: "FX 4", param: "Factor L", value: "1" }))).toEqual({ "/fx/4/par/04": 4 });
  });

  it("refuses retyping a send effect (guard 3, acceptance 9), and asks before retyping a free one", () => {
    expect(() => setFxType(desk(), { target: "FX 1", effect: "PLAT" })).toThrow("FX 1 is a send effect (fed by Reverb)");
    const plan = setFxType(desk(), { target: "Delay", effect: "DLY" });
    expect(plan.summary).toBe("Change FX 2 to Stereo Delay (DLY)");
    expect(plan.confirm).not.toBeNull();
  });

  it("says what it can't find", () => {
    expect(() => setFxParam(desk(), { target: "Moon", param: "Mix", value: 1 })).toThrow('No effect at "Moon"');
    expect(() => setFxParam(desk(), { target: "Reverb", param: "Wobble", value: 1 })).toThrow("Wobble isn't a parameter here");
  });
});
