import { describe, expect, it } from "vitest";
import { studioDesk, studioShared } from "../../e2e/studio";
import { send, strip } from "./addresses";
import type { DeskValue } from "./cache";
import { overlay } from "./guards";
import { includeEffects, Refused, removeSend, sendTo, undoPlan, type Plan, type PlanContext } from "./planner";
import { liveTarget } from "./shared";

function desk(): PlanContext & { values: Map<string, DeskValue>; apply: (p: Plan) => void } {
  const values = new Map([...studioDesk()].map(([a, arg]) => [a, arg.value as DeskValue]));
  return {
    values,
    get: (a) => values.get(a),
    shared: studioShared,
    apply: (p) => p.changes.forEach((c) => values.set(c.param.address, c.value)),
  };
}

const on = (ctx: PlanContext, ch: number, bus: number) => {
  const m = send(strip("ch", ch), bus);
  return ctx.get(m.on.address) === 1 && Number(ctx.get(m.level.address)) > 0;
};

describe("sendTo", () => {
  it("sends a stereo source to a stereo bus at 0 dB, straight away", () => {
    const ctx = desk();
    const plan = sendTo(ctx, { source: "S-1", destination: "Delay", mode: "add" });
    expect(plan.summary).toBe("Send S-1 to Delay at 0 dB");
    expect(plan.confirm).toBeNull();
    expect(plan.changes.map((c) => c.param.address)).toEqual([
      "/ch/09/mix/03/level", "/ch/09/mix/04/level", "/ch/10/mix/03/level", "/ch/10/mix/04/level",
    ]); // sends are on at -inf from the factory, so only the levels change
    ctx.apply(plan);
    expect(on(ctx, 9, 3)).toBe(true);
  });

  it("takes a level in dB", () => {
    const plan = sendTo(desk(), { source: "Mic", destination: "Reverb", mode: "add", levelDb: -10 });
    expect(plan.summary).toBe("Send Mic to Reverb at -10 dB");
  });

  it("switches the Sampler to the target it names, and asks first", () => {
    const ctx = desk();
    const plan = sendTo(ctx, { source: "S-1", destination: "P-6", mode: "add" });
    expect(plan.summary).toBe("Send S-1 to the Sampler (→ P-6) at 0 dB; switch the Sampler to the P-6");
    expect(plan.confirm).not.toBeNull();
    expect(plan.changes.filter((c) => c.param.address.startsWith("/outputs/")).map((c) => [c.param.address, c.value])).toEqual([
      ["/outputs/main/01/src", 0], ["/outputs/main/02/src", 0], ["/outputs/aux/01/src", 14], ["/outputs/aux/02/src", 15],
    ]);
    ctx.apply(plan);
    expect(liveTarget(ctx.get, studioShared[0]!)).toBe("P-6");
  });

  it("replaces the other sources on the bus, and asks first", () => {
    const ctx = desk();
    ctx.apply(sendTo(ctx, { source: "TR-8S", destination: "Sampler", mode: "add" }));
    const plan = sendTo(ctx, { source: "S-1", destination: "Sampler", mode: "replace" });
    expect(plan.summary).toBe("Send S-1 to Sampler at 0 dB; stop sending TR-8S to it");
    expect(plan.confirm).not.toBeNull();
    ctx.apply(plan);
    expect([on(ctx, 5, 11), on(ctx, 9, 11)]).toEqual([false, true]);
  });

  it("keeps the others with add (acceptance 3)", () => {
    const ctx = desk();
    ctx.apply(sendTo(ctx, { source: "S-1", destination: "Sampler", mode: "add" }));
    ctx.apply(sendTo(ctx, { source: "TB-3", destination: "Sampler", mode: "add" }));
    expect([on(ctx, 9, 11), on(ctx, 7, 11)]).toEqual([true, true]);
  });

  it("refuses a device's return to its own feed (guard 1, acceptance 4)", () => {
    expect(() => sendTo(desk(), { source: "King Rat", destination: "King Rat", mode: "add" })).toThrow("King Rat (ch 4) would be sent to its own feed");
    expect(() => sendTo(desk(), { source: "SP-404 Mk2", destination: "Sampler", mode: "add" })).toThrow("would be sent to the Sampler bus while it goes to the SP-404 Mk2");
    expect(() => sendTo(desk(), { source: "SP-404 Mk2", destination: "SP-404 Mk2", mode: "add" })).toThrow(Refused);
  });

  it("refuses switching the Sampler to a device already sent to it", () => {
    const ctx = desk();
    ctx.apply(sendTo(ctx, { source: "P-6", destination: "Sampler", mode: "add" })); // fine while it goes to the SP-404
    expect(() => sendTo(ctx, { source: "S-1", destination: "P-6", mode: "add" })).toThrow("P-6 would be sent to the Sampler bus while it goes to the P-6");
  });

  it("refuses an FX return into its own FX slot (guard 2)", () => {
    expect(() => sendTo(desk(), { source: "Reverb Rtn", destination: "Reverb", mode: "add" })).toThrow("Reverb Rtn would be sent back into FX 1");
  });

  it("says which names it knows", () => {
    expect(() => sendTo(desk(), { source: "Moog", destination: "Reverb", mode: "add" })).toThrow(/No source named "Moog". Sources: Volca Kick, Volca Bass/);
    expect(() => sendTo(desk(), { source: "TB-3", destination: "Moon", mode: "add" })).toThrow(/No destination named "Moon". Destinations: Reverb, Delay.*SP-404 Mk2, Koala, P-6/);
  });

  it("plans nothing when it's already so", () => {
    expect(sendTo(desk(), { source: "TB-3", destination: "Reverb", mode: "add", levelDb: -2 }).changes.map((c) => c.param.address)).not.toContain("/ch/07/mix/01/on");
  });
});

describe("removeSend and includeEffects", () => {
  it("switches a send off, after asking", () => {
    const ctx = desk();
    const plan = removeSend(ctx, { source: "TB-3", destination: "Reverb" });
    expect(plan.changes.map((c) => [c.param.address, c.value])).toContainEqual(["/ch/07/mix/01/on", 0]);
    expect(plan.confirm).not.toBeNull();
  });

  it("adds the effect returns and the King Rat to a sampler bus", () => {
    const plan = includeEffects(desk(), { destination: "Sampler", on: true });
    expect(plan.summary).toBe("Also send Reverb Rtn, Delay Rtn, FX3 Rtn, FX4 Rtn, King Rat to Sampler");
    expect(plan.confirm).toBeNull();
  });
});

describe("undoPlan", () => {
  it("puts back what the plan changed, in reverse", () => {
    const ctx = desk();
    const plan = sendTo(ctx, { source: "S-1", destination: "P-6", mode: "add" });
    ctx.apply(plan);
    const undo = undoPlan(ctx, plan);
    expect(undo.confirm).toBeNull();
    expect(undo.changes[0]!.step).toBe(1); // the sends come off before the outputs switch back
    ctx.apply(undo);
    expect(liveTarget(ctx.get, studioShared[0]!)).toBe("SP-404 Mk2");
    expect(on(ctx, 9, 11)).toBe(false);
  });

  it("asks first if a value was changed since", () => {
    const ctx = desk();
    const plan = sendTo(ctx, { source: "S-1", destination: "Delay", mode: "add" });
    ctx.apply(plan);
    ctx.values.set("/ch/09/mix/03/level", 0.5); // moved in X32-Edit
    expect(undoPlan(ctx, plan).confirm).toMatch(/^1 of its values changed since/);
  });
});

describe("overlay", () => {
  it("reads the writes first", () => {
    const get = overlay((a) => (a === "x" ? 1 : 2), [{ param: { address: "x" }, value: 3 }]);
    expect([get("x"), get("y")]).toEqual([3, 2]);
  });
});
