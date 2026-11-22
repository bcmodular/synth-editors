// The tools the model can call (docs/x32-spec.md, "Intent tools"), with strict schemas, and running them. Every tool
// takes names as the desk shows them and goes through the same planner, guards and operator as the Sends panel.

import type Anthropic from "@anthropic-ai/sdk";
import { includeEffects, removeSend, sendTo, type Plan, type PlanContext, type SendMode } from "./planner";

export interface ToolOutcome {
  text: string;
  kind: string; // the operator's outcome ("applied", "waiting", …), "refused" or "error"
}

// What the tools need from the app.
export interface ToolHost {
  state(names: string[]): string;
  run(make: (ctx: PlanContext) => Plan): Promise<ToolOutcome>;
  undo(): Promise<ToolOutcome>;
}

const object = (properties: Record<string, unknown>) => ({
  type: "object" as const,
  properties,
  required: Object.keys(properties),
  additionalProperties: false,
});

const name = (description: string) => ({ type: "string", description });

export const TOOLS: Anthropic.Tool[] = [
  {
    name: "get_state",
    description: "Read the desk now: sources and their sends, destinations, the shared Sampler bus and the FX slots. Pass names to narrow it, or an empty list for everything.",
    input_schema: object({ names: { type: "array", items: { type: "string" }, description: "Source or destination names as the desk shows them" } }),
  },
  {
    name: "send_to",
    description: "Send a source to a destination. mode replace also switches off every other source sending to that destination; add keeps them. Sending to a target of a shared bus (P-6, Koala, SP-404 Mk2) switches the Sampler to it.",
    input_schema: object({
      source: name("Source name, as the desk shows it"),
      destination: name("Destination name: a bus, or a target of a shared bus"),
      mode: { type: "string", enum: ["add", "replace"] },
      level_db: { type: ["number", "null"], description: "Send level in dB, -90 to +10; null for 0 dB" },
    }),
  },
  {
    name: "remove_send",
    description: "Stop sending a source to a destination.",
    input_schema: object({ source: name("Source name"), destination: name("Destination name") }),
  },
  {
    name: "include_effects",
    description: "Also send (on) or stop sending (off) the FX returns and the other devices' returns (the King Rat) to a destination, for sampling with effects.",
    input_schema: object({ destination: name("Destination name"), on: { type: "boolean" } }),
  },
  {
    name: "undo",
    description: "Undo the last plan that was applied.",
    input_schema: object({}),
  },
].map((t) => ({ ...t, strict: true }));

type Input = Record<string, unknown>;
const str = (v: unknown) => String(v ?? "");

const RUNNERS: Record<string, (host: ToolHost, input: Input) => Promise<ToolOutcome>> = {
  get_state: async (host, input) => ({ text: host.state(((input.names as string[]) ?? []).map(String)), kind: "state" }),
  send_to: (host, input) =>
    host.run((ctx) => sendTo(ctx, {
      source: str(input.source), destination: str(input.destination), mode: input.mode as SendMode,
      levelDb: typeof input.level_db === "number" ? input.level_db : 0,
    })),
  remove_send: (host, input) => host.run((ctx) => removeSend(ctx, { source: str(input.source), destination: str(input.destination) })),
  include_effects: (host, input) => host.run((ctx) => includeEffects(ctx, { destination: str(input.destination), on: input.on === true })),
  undo: (host) => host.undo(),
};

// What the model is told, beyond the outcome itself.
const FOR_THE_MODEL: Record<string, string> = {
  waiting: " Nothing is written yet: the user sees the plan with Apply and Cancel buttons. Don't say it's done.",
  refused: " Nothing was written. Tell the user why.",
};

export async function runTool(host: ToolHost, tool: string, input: Input): Promise<ToolOutcome & { isError: boolean }> {
  const runner = RUNNERS[tool];
  if (!runner) return { text: `No tool named ${tool}`, kind: "error", isError: true };
  const out = await runner(host, input);
  const bad = out.kind === "refused" || out.kind === "error" || out.kind === "mismatch" || out.kind === "offline";
  return { ...out, text: out.text + (FOR_THE_MODEL[out.kind] ?? ""), isError: bad };
}
