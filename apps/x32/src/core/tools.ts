// The tools the model can call (docs/x32-spec.md, "Intent tools"), with strict schemas, and running them. Every tool
// takes names as the desk shows them and goes through the same planner, guards and operator as the Sends panel.

import type Anthropic from "@anthropic-ai/sdk";
import { insertFx, removeInsert, setFxParam, setFxType } from "./fxPlanner";
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
    name: "insert_fx",
    description: "Put an effect on a source as an insert, in a free FX slot (send effects are never taken). Only effects with a dry/wet mix can be inserts: Stereo Delay (DLY) and Stereo Chorus (CRS). A delay goes in at 30% mix, a dotted eighth.",
    input_schema: object({
      source: name("Source name; it must be on a channel"),
      effect: name("Effect code or name: DLY, Stereo Delay, CRS, Stereo Chorus"),
      mix_percent: { type: ["number", "null"], description: "Dry/wet mix in percent; null for the default (30)" },
    }),
  },
  {
    name: "remove_insert",
    description: "Take the insert off a source. If the slot was fed from a bus before, it's fed from it again.",
    input_schema: object({ source: name("Source name") }),
  },
  {
    name: "set_fx_param",
    description: "Change one parameter of an effect, in its own units (seconds, ms, Hz, %, or a choice like 3/2 or ST). get_state lists each slot's parameters. A delay's Time follows the tempo, so change its Factor for the note value.",
    input_schema: object({
      target: name("FX slot (FX 1-8), a bus that feeds one (Reverb, Delay), or a source with an insert"),
      param: name("Parameter name as get_state shows it: Decay, Mix, Factor L"),
      value: { type: "string", description: "The new value: a number in the parameter's units, or a choice" },
    }),
  },
  {
    name: "set_fx_type",
    description: "Change the effect type of a slot that isn't a send effect in use. Send effects (a slot fed by a bus something is sent to) are protected and refused.",
    input_schema: object({ target: name("FX slot (FX 1-8) or a bus that feeds one"), effect: name("Effect code or name: DLY, HALL, Stereo Chorus") }),
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
  insert_fx: (host, input) =>
    host.run((ctx) => insertFx(ctx, {
      source: str(input.source), effect: str(input.effect),
      ...(typeof input.mix_percent === "number" ? { params: { Mix: input.mix_percent } } : {}),
    })),
  remove_insert: (host, input) => host.run((ctx) => removeInsert(ctx, { source: str(input.source) })),
  set_fx_param: (host, input) => host.run((ctx) => setFxParam(ctx, { target: str(input.target), param: str(input.param), value: str(input.value) })),
  set_fx_type: (host, input) => host.run((ctx) => setFxType(ctx, { target: str(input.target), effect: str(input.effect) })),
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
