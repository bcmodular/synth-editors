import { describe, expect, it } from "vitest";
import { deskKind, requestEntry, rigHash } from "./chatLog";
import type { PlanContext } from "./planner";
import { runTool, TOOLS, type ToolHost } from "./tools";

function host(): ToolHost & { asked: string[] } {
  const asked: string[] = [];
  return {
    asked,
    state: (names) => `state:${names.join(",")}`,
    presets: (query) => `presets:${query}`,
    run: async (make) => {
      try {
        const plan = make({ get: () => undefined, shared: [] } as PlanContext);
        asked.push(plan.summary);
        return { text: "ok", kind: "applied" };
      } catch (e) {
        return { text: (e as Error).message, kind: "refused" };
      }
    },
    undo: async () => ({ text: "undone", kind: "applied" }),
  };
}

describe("TOOLS", () => {
  it("are strict, with every property required and nothing else allowed", () => {
    for (const t of TOOLS) {
      const schema = t.input_schema as unknown as { required: string[]; properties: object; additionalProperties: boolean };
      expect(t.strict).toBe(true);
      expect(schema.additionalProperties).toBe(false);
      expect(schema.required.sort()).toEqual(Object.keys(schema.properties).sort());
    }
  });
});

describe("runTool", () => {
  it("reads state and undoes", async () => {
    expect((await runTool(host(), "get_state", { names: ["TB-3"] })).text).toBe("state:TB-3");
    expect(await runTool(host(), "undo", {})).toMatchObject({ text: "undone", isError: false });
  });

  it("marks refusals and unknown tools as errors, and tells the model a held plan isn't done", async () => {
    const h = host();
    const refused = await runTool(h, "send_to", { source: "X", destination: "Y", mode: "add", level_db: null });
    expect(refused).toMatchObject({ kind: "refused", isError: true });
    expect(refused.text).toMatch(/No source named "X".*Tell the user why/);
    expect(await runTool(h, "fade_out", {})).toMatchObject({ isError: true });
    const waiting = await runTool({ ...h, run: async () => ({ text: "Waiting", kind: "waiting" }) }, "remove_send", { source: "a", destination: "b" });
    expect(waiting.text).toContain("Don't say it's done");
  });
});

describe("chat log", () => {
  it("hashes the rig, tells the fake from the real desk, and keeps tokens and calls", () => {
    expect(rigHash("a")).toMatch(/^[0-9a-f]{8}$/);
    expect(rigHash("a")).not.toBe(rigHash("b"));
    expect([deskKind("127.0.0.1:50123"), deskKind("192.168.0.138:10023")]).toEqual(["fake", "real"]);
    const turn = { reply: "Done.", calls: [{ name: "send_to", input: { source: "S-1" }, result: "ok", kind: "applied" }], usage: { input: 1, output: 2, cacheRead: 3, cacheWrite: 4 }, rounds: 2, error: null };
    const entry = requestEntry({ time: "t", desk: "fake", rig: "abc" }, { typed: "route S-1", model: "m", turn, latencyMs: 900 });
    expect(entry).toMatchObject({ kind: "request", typed: "route S-1", tokens: { cacheRead: 3 }, calls: [{ name: "send_to" }] });
  });
});
