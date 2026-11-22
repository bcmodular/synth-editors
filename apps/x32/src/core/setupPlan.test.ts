import { describe, expect, it } from "vitest";
import studio from "../../rig/studio.json";
import { desiredTargets } from "./desired";
import { parseRigFile } from "./rigFile";
import { applyOrder, manualSteps, planSetup, show } from "./setupPlan";

const rig = parseRigFile(studio);
const targets = desiredTargets(rig);

describe("planSetup", () => {
  it("lists every target on a desk that doesn't answer, grouped by area", () => {
    const plan = planSetup(targets, () => undefined);
    expect(plan.changes).toHaveLength(targets.length);
    expect(plan.byArea.routing.length).toBe(36);
    expect(plan.byArea.fx.length).toBe(6);
    expect(plan.unchanged).toBe(0);
  });

  it("leaves out what already matches", () => {
    const desk = new Map(targets.map((t) => [t.param.address, t.value]));
    desk.set("/ch/03/config/name", "");
    const plan = planSetup(targets, (a) => desk.get(a));
    expect(plan.changes.map((c) => [c.what, c.from, c.value])).toEqual([['ch 3 named "TD-3-MO"', "", "TD-3-MO"]]);
    expect(plan.unchanged).toBe(targets.length - 1);
  });

  it("orders writes routing first and names last", () => {
    const order = applyOrder(planSetup(targets, () => undefined).changes).map((c) => c.step);
    expect(order).toEqual([...order].sort((a, b) => a - b));
    expect(order[0]).toBe(1);
    expect(order.at(-1)).toBe(6);
  });

  it("turns phantom notes into manual steps", () => {
    expect(manualSteps(rig)[0]).toBe("Mic: phantom power, check: only if the mic is a condenser (switch it in X32-Edit; the app never does)");
    expect(manualSteps(rig)).toContain(rig.manual[0]);
  });

  it("shows values for people", () => {
    expect(show(undefined)).toBe("(no answer)");
    expect(show("P-6")).toBe('"P-6"');
    expect(show(3)).toBe("3");
  });
});
