// The tool-use loop (docs/x32-spec.md, "Agent loop"): a manual loop against an injected create(), so tests can script
// the model and the request goes through the main process, which holds the key. One conversation per app run.

import type Anthropic from "@anthropic-ai/sdk";
import { SYSTEM_PROMPT } from "./systemPrompt";
import { runTool, TOOLS, type ToolHost } from "./tools";

export type Create = (request: Anthropic.MessageCreateParamsNonStreaming) => Promise<{ message?: Anthropic.Message; error?: string }>;

export interface ToolCall {
  name: string;
  input: Record<string, unknown>;
  result: string;
  kind: string;
}

export interface Usage {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
}

export interface Turn {
  reply: string;
  calls: ToolCall[];
  usage: Usage;
  rounds: number;
  error: string | null;
}

export interface AgentOptions {
  model: string;
  create: Create;
  host: ToolHost;
  maxTokens?: number;
  maxRounds?: number;
}

const MAX_ROUNDS = 8;
const MAX_TOKENS = 2048;
const ZERO: Usage = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };

const add = (a: Usage, u: Anthropic.Usage): Usage => ({
  input: a.input + u.input_tokens,
  output: a.output + u.output_tokens,
  cacheRead: a.cacheRead + (u.cache_read_input_tokens ?? 0),
  cacheWrite: a.cacheWrite + (u.cache_creation_input_tokens ?? 0),
});

const textOf = (m: Anthropic.Message) =>
  m.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("\n").trim();

// What a finished response leaves the user with, or null to keep looping.
function ending(m: Anthropic.Message): string | null {
  if (m.stop_reason === "refusal") return "The model declined to answer that.";
  if (m.stop_reason === "max_tokens") return textOf(m) || "The reply was cut short.";
  if (m.stop_reason === "tool_use" || m.stop_reason === "pause_turn") return null;
  return textOf(m);
}

export class Conversation {
  private messages: Anthropic.MessageParam[] = [];

  constructor(private readonly options: AgentOptions) {}

  get started(): boolean {
    return this.messages.length > 0;
  }

  // One user request, run to the end. The first request of a conversation carries the desk's state.
  async send(text: string, deskState: string): Promise<Turn> {
    const start = this.messages.length;
    const intro = this.started ? [] : [{ type: "text" as const, text: `The desk now:\n${deskState}` }];
    this.messages.push({ role: "user", content: [...intro, { type: "text", text }] });
    const turn: Turn = { reply: "", calls: [], usage: ZERO, rounds: 0, error: null };
    while (!(await this.round(turn))) {
      if (turn.rounds >= (this.options.maxRounds ?? MAX_ROUNDS)) turn.error = "Stopped after too many steps.";
    }
    // A turn that failed part-way is forgotten, so the conversation the model sees next stays valid.
    if (turn.error) this.messages.length = start;
    return turn;
  }

  private request(): Anthropic.MessageCreateParamsNonStreaming {
    return {
      model: this.options.model,
      max_tokens: this.options.maxTokens ?? MAX_TOKENS,
      system: SYSTEM_PROMPT,
      tools: TOOLS,
      messages: this.messages,
      cache_control: { type: "ephemeral" }, // caches the system prompt, tools and conversation so far
      output_config: { effort: "low" },
    };
  }

  // One request to the model, and its tools run. True when the turn is over.
  private async round(turn: Turn): Promise<boolean> {
    if (turn.error) return true;
    turn.rounds++;
    const { message, error } = await this.options.create(this.request());
    if (!message) {
      turn.error = error ?? "No answer from the model.";
      return true;
    }
    turn.usage = add(turn.usage, message.usage);
    this.messages.push({ role: "assistant", content: message.content });
    const end = ending(message);
    if (end !== null) {
      turn.reply = end;
      return true;
    }
    if (message.stop_reason === "tool_use") await this.runTools(message, turn);
    return false;
  }

  private async runTools(message: Anthropic.Message, turn: Turn): Promise<void> {
    const results: Anthropic.ToolResultBlockParam[] = [];
    for (const block of message.content) {
      if (block.type !== "tool_use") continue;
      const input = (block.input ?? {}) as Record<string, unknown>;
      const out = await runTool(this.options.host, block.name, input);
      turn.calls.push({ name: block.name, input, result: out.text, kind: out.kind });
      results.push({ type: "tool_result", tool_use_id: block.id, content: out.text, is_error: out.isError });
    }
    this.messages.push({ role: "user", content: results });
  }
}
