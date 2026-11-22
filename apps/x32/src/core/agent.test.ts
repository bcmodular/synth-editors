import type Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it } from "vitest";
import { Conversation, type Create } from "./agent";
import type { ToolHost } from "./tools";

const usage = { input_tokens: 100, output_tokens: 20, cache_read_input_tokens: 80, cache_creation_input_tokens: 0 } as Anthropic.Usage;

function message(content: unknown[], stop_reason: Anthropic.StopReason): Anthropic.Message {
  return { id: "m", type: "message", role: "assistant", model: "x", content, stop_reason, stop_sequence: null, usage } as Anthropic.Message;
}

const toolUse = (name: string, input: object, id = "t1") => ({ type: "tool_use", id, name, input });
const text = (t: string) => ({ type: "text", text: t });

// The model's replies, in order, and every request it got.
function scripted(replies: (Anthropic.Message | string)[]) {
  const requests: Anthropic.MessageCreateParamsNonStreaming[] = [];
  const create: Create = async (r) => {
    requests.push(structuredClone(r));
    const next = replies.shift();
    return typeof next === "string" ? { error: next } : { message: next };
  };
  return { create, requests };
}

const host = (): ToolHost & { ran: string[] } => {
  const ran: string[] = [];
  return {
    ran,
    state: (names) => `state of ${names.join(", ") || "everything"}`,
    presets: (query) => `presets for ${query}`,
    run: async (make) => {
      ran.push("run");
      void make;
      return { text: "Waiting for you to confirm: Send S-1 to the Sampler (→ P-6) at 0 dB.", kind: "waiting" };
    },
    undo: async () => ({ text: "Done: Undo", kind: "applied" }),
  };
};

describe("Conversation", () => {
  it("runs tools until the model answers, carrying the desk's state in the first message only", async () => {
    const { create, requests } = scripted([
      message([text("Sending."), toolUse("send_to", { source: "S-1", destination: "P-6", mode: "replace", level_db: null })], "tool_use"),
      message([text("It's waiting for you to press Apply.")], "end_turn"),
      message([text("Undone.")], "end_turn"),
    ]);
    const h = host();
    const c = new Conversation({ model: "claude-haiku-5-5", create, host: h });
    const turn = await c.send("route S-1 to the P-6", "Sources: …");
    expect(turn.reply).toBe("It's waiting for you to press Apply.");
    expect(turn.calls).toEqual([expect.objectContaining({ name: "send_to", kind: "waiting" })]);
    expect(turn.usage).toEqual({ input: 200, output: 40, cacheRead: 160, cacheWrite: 0 });
    expect(turn.rounds).toBe(2);
    expect(h.ran).toEqual(["run"]);

    const second = requests[1]!;
    const result = (second.messages.at(-1)!.content as Anthropic.ToolResultBlockParam[])[0]!;
    expect(result).toMatchObject({ type: "tool_result", tool_use_id: "t1", is_error: false });
    expect(String(result.content)).toContain("Don't say it's done");
    expect(second.cache_control).toEqual({ type: "ephemeral" });
    expect(second.tools?.every((t) => "strict" in t && t.strict)).toBe(true);

    await c.send("undo that", "Sources: changed");
    const third = requests[2]!;
    expect(JSON.stringify(third.messages[0])).toContain("The desk now");
    expect(JSON.stringify(third.messages.at(-1))).not.toContain("The desk now");
  });

  it("marks a refused plan as an error for the model", async () => {
    const { create, requests } = scripted([
      message([toolUse("send_to", { source: "King Rat", destination: "King Rat", mode: "add", level_db: null })], "tool_use"),
      message([text("That would loop.")], "end_turn"),
    ]);
    const h = { ...host(), run: async () => ({ text: "Refused: King Rat (ch 4) would be sent to its own feed", kind: "refused" }) };
    await new Conversation({ model: "m", create, host: h }).send("send the king rat to itself", "");
    const result = (requests[1]!.messages.at(-1)!.content as Anthropic.ToolResultBlockParam[])[0]!;
    expect(result.is_error).toBe(true);
  });

  it("forgets a turn that failed, so the next request is valid", async () => {
    const { create, requests } = scripted([
      message([toolUse("get_state", { names: [] })], "tool_use"),
      "overloaded",
      message([text("Hello.")], "end_turn"),
    ]);
    const c = new Conversation({ model: "m", create, host: host() });
    expect((await c.send("what's going on?", "state")).error).toBe("overloaded");
    await c.send("hi", "state");
    expect(requests[2]!.messages).toHaveLength(1); // the failed turn is gone; the state comes again
    expect(JSON.stringify(requests[2]!.messages[0])).toContain("The desk now");
  });

  it("stops on a refusal and after too many rounds", async () => {
    const refusal = scripted([message([], "refusal")]);
    expect((await new Conversation({ model: "m", create: refusal.create, host: host() }).send("x", "")).reply).toBe("The model declined to answer that.");
    const loop = scripted(Array.from({ length: 5 }, (_, i) => message([toolUse("get_state", { names: [] }, `t${i}`)], "tool_use")));
    const turn = await new Conversation({ model: "m", create: loop.create, host: host(), maxRounds: 3 }).send("x", "");
    expect(turn.error).toBe("Stopped after too many steps.");
    expect(loop.requests).toHaveLength(3);
  });
});
