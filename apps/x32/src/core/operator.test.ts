import { describe, expect, it } from "vitest";
import { memoryDesk, studioShared } from "../../e2e/studio";
import { NotAllowed } from "./applier";
import { chatAllowed, Operator } from "./operator";
import { sendTo, type Plan, type PlanContext } from "./planner";

function setup(connected = true) {
  const desk = memoryDesk(connected);
  const ctx: PlanContext = { get: (a) => desk.values.get(a), shared: studioShared };
  return { values: desk.values, writes: desk.writes, ctx, op: new Operator(desk, chatAllowed(studioShared)) };
}

describe("Operator", () => {
  it("applies a plan that needs no confirmation straight away, and undoes it", async () => {
    const { op, ctx, values } = setup();
    const outcome = await op.propose(sendTo(ctx, { source: "S-1", destination: "Delay", mode: "add" }));
    expect(outcome.kind).toBe("applied");
    expect(values.get("/ch/09/mix/03/level")).toBeCloseTo(0.75, 2);
    expect(op.lastApplied?.summary).toBe("Send S-1 to Delay at 0 dB");
    expect((await op.undo(ctx))?.kind).toBe("applied");
    expect(values.get("/ch/09/mix/03/level")).toBe(0);
    expect(op.lastApplied).toBeNull();
  });

  it("holds a plan that needs confirming until confirm", async () => {
    const { op, ctx, writes } = setup();
    expect((await op.propose(sendTo(ctx, { source: "S-1", destination: "P-6", mode: "add" }))).kind).toBe("waiting");
    expect(writes).toEqual([]);
    expect(op.pending?.summary).toMatch(/switch the Sampler to the P-6/);
    expect((await op.confirm())?.kind).toBe("applied");
    expect(writes).toContain("/outputs/aux/01/src");
    expect(op.pending).toBeNull();
  });

  it("drops a held plan on cancel", async () => {
    const { op, ctx, writes } = setup();
    await op.propose(sendTo(ctx, { source: "S-1", destination: "P-6", mode: "add" }));
    op.cancel();
    expect(await op.confirm()).toBeNull();
    expect(writes).toEqual([]);
  });

  it("holds an undo whose values were changed since, and doesn't put the undo itself on the stack", async () => {
    const { op, ctx, values } = setup();
    await op.propose(sendTo(ctx, { source: "S-1", destination: "Delay", mode: "add" }));
    values.set("/ch/09/mix/03/level", 0.5);
    expect((await op.undo(ctx))?.kind).toBe("waiting");
    await op.confirm();
    expect(values.get("/ch/09/mix/03/level")).toBe(0);
    expect(op.lastApplied).toBeNull();
  });

  it("writes nothing while the desk is out of reach", async () => {
    const { op, ctx, writes } = setup(false);
    expect((await op.propose(sendTo(ctx, { source: "S-1", destination: "Delay", mode: "add" }))).kind).toBe("offline");
    expect(writes).toEqual([]);
  });

  it("refuses anything outside the chat's list", async () => {
    const { op } = setup();
    const plan: Plan = { summary: "x", confirm: null, changes: [{ param: { address: "/ch/01/mix/fader", type: "f" }, value: 1, from: 0, what: "fader" }] };
    await expect(op.propose(plan)).rejects.toBeInstanceOf(NotAllowed);
    expect(chatAllowed(studioShared).some((r) => r.test("/outputs/main/05/src"))).toBe(false);
    expect(chatAllowed(studioShared).some((r) => r.test("/outputs/main/03/src"))).toBe(true); // Koala, a Sampler target
  });
});
