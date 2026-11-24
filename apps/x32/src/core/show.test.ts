import { describe, expect, it } from "vitest";
import { memoryDesk, studioShared } from "../../e2e/studio";
import { chatAllowed, Operator } from "./operator";
import type { PlanContext } from "./planner";
import { snippet } from "./routing";
import { EFFECT_EVENTS, recallPlan, ROUTING_EVENTS, saveSnippetPlan, showSlots } from "./show";

function setup() {
  const desk = memoryDesk();
  let reread = 0;
  const ctx: PlanContext = { get: (a) => desk.values.get(a), shared: studioShared };
  const op = new Operator(desk, chatAllowed(studioShared), () => reread++);
  desk.values.set("/-show/showfile/scene/003/name", "Studio base");
  desk.values.set("/-show/showfile/scene/003/hasdata", 1);
  return { desk, ctx, op, rereads: () => reread };
}

describe("saveSnippetPlan", () => {
  it("sets a free slot's filters to the routing, then saves it by name", async () => {
    const { desk, ctx, op } = setup();
    const plan = saveSnippetPlan(ctx, { name: "TR-8S to SP-404", effects: false });
    expect(plan.summary).toBe('Save the routing as snippet 0 "TR-8S to SP-404"');
    expect(plan.confirm).toBeNull();
    expect((await op.propose(plan)).kind).toBe("applied");
    expect(desk.values.get(snippet(0).eventtyp.address)).toBe(ROUTING_EVENTS);
    expect(desk.values.get(snippet(0).channels.address)).toBe(-1);
    expect(desk.writes.at(-1)).toBe("/save snippet 0 TR-8S to SP-404");
    expect(showSlots(ctx.get, "snippet")[0]).toEqual({ index: 0, name: "TR-8S to SP-404", used: true });
    expect(op.lastApplied).toBeNull(); // not undoable
  });

  it("holds the effects too when asked, and asks before replacing one of the same name", async () => {
    const { ctx, op } = setup();
    await op.propose(saveSnippetPlan(ctx, { name: "Jam", effects: false }));
    const again = saveSnippetPlan(ctx, { name: "jam", effects: true });
    expect(again.summary).toBe('Save the routing and effects as snippet 0 "jam", replacing it');
    expect(again.confirm).toBe('It replaces snippet 0 "Jam"');
    expect(again.changes.find((c) => c.param.address.endsWith("/eventtyp"))?.value).toBe(ROUTING_EVENTS | EFFECT_EVENTS);
  });

  it("refuses a name that's too long", () => {
    expect(() => saveSnippetPlan(setup().ctx, { name: "A name far too long for it", effects: false })).toThrow("1-16 characters");
  });
});

describe("recallPlan", () => {
  it("loads a scene by part of its name, after asking, and re-reads the desk", async () => {
    const { ctx, op, desk, rereads } = setup();
    const plan = recallPlan(ctx, { kind: "scene", name: "base" });
    expect(plan.summary).toBe('Load scene 3 "Studio base"');
    expect(plan.confirm).toMatch(/whole desk/);
    expect((await op.propose(plan)).kind).toBe("waiting");
    expect((await op.confirm())?.kind).toBe("applied");
    expect(desk.writes).toEqual(["/load scene 3"]);
    expect(rereads()).toBe(1);
  });

  it("says which ones there are", () => {
    expect(() => recallPlan(setup().ctx, { kind: "scene", name: "gig" })).toThrow('No scene named "gig". Scenes: "Studio base"');
    expect(() => recallPlan(setup().ctx, { kind: "snippet", name: "x" })).toThrow("Snippets: none");
  });
});
