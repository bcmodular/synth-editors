// The prompt check (docs/x32-spec.md, "Testing"): a few phrases against the real model and an in-memory desk set up
// from the rig file, checking which tools it calls and what happens to the plan. It costs money (about a cent), so it
// only runs when asked: npm run prompt-check -w apps/x32. Nothing reaches the real desk.

import { execFileSync } from "node:child_process";
import Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it } from "vitest";
import { studioDesk, studioShared } from "../../e2e/studio";
import type { Param } from "./addresses";
import { Conversation, type Create, type Turn } from "./agent";
import type { DeskValue } from "./cache";
import { chatAllowed, Operator, type Outcome } from "./operator";
import { describeOutcome } from "./outcome";
import { Refused, type PlanContext } from "./planner";
import { rigSummary } from "./rigSummary";
import type { ToolHost, ToolOutcome } from "./tools";
import { addUsage, usageText, ZERO_USAGE } from "./usage";

const MODEL = process.env.X32_MODEL ?? "claude-haiku-5-5";
const LIVE = process.env.X32_PROMPT_CHECK === "1";

function apiKey(): string {
  return execFileSync("security", ["find-generic-password", "-s", "X32 Chat Control", "-a", "anthropic-api-key", "-w"]).toString().trim();
}

// An in-memory desk and the same operator the app uses.
function session(create: Create) {
  const values = new Map([...studioDesk()].map(([a, arg]) => [a, arg.value as DeskValue]));
  const writes: string[] = [];
  const desk = {
    connected: () => true,
    write: (p: Param, v: DeskValue) => {
      writes.push(p.address);
      values.set(p.address, v);
    },
    read: async (p: Param) => values.get(p.address)!,
  };
  const operator = new Operator(desk, chatAllowed(studioShared));
  const ctx = (): PlanContext => ({ get: (a) => values.get(a), shared: studioShared });
  const settle = async (work: () => Promise<Outcome | null>): Promise<ToolOutcome> => {
    try {
      const o = await work();
      return o ? { text: describeOutcome(o), kind: o.kind } : { text: "Nothing to do.", kind: "none" };
    } catch (e) {
      return { text: (e as Error).message, kind: e instanceof Refused ? "refused" : "error" };
    }
  };
  const host: ToolHost = {
    state: (names) => rigSummary({ get: ctx().get, shared: studioShared, names }),
    run: (make) => settle(async () => operator.propose(make(ctx()))),
    undo: () => settle(() => operator.undo(ctx())),
  };
  const conversation = new Conversation({ model: MODEL, create, host });
  const say = (text: string) => conversation.send(text, host.state([]));
  return { say, writes, values, operator };
}

interface Case {
  say: string[]; // one conversation; the last turn is checked
  check: (turn: Turn, s: ReturnType<typeof session>) => string | null; // a problem, or null
}

const sendCall = (t: Turn) => t.calls.find((c) => c.name === "send_to");
// The first send_to has every input given, or why not.
function sentWith(t: Turn, want: Record<string, unknown>): string | null {
  const c = sendCall(t);
  if (!c) return "no send_to";
  const wrong = Object.entries(want).filter(([k, v]) => c.input[k] !== v);
  return wrong.length ? `expected ${JSON.stringify(want)}, got ${JSON.stringify(c.input)}` : null;
}
const CASES: Case[] = [
  {
    say: ["route S-1 to the P-6"],
    check: (t) => sentWith(t, { source: "S-1", destination: "P-6", mode: "replace" }) ?? (sendCall(t)!.kind === "waiting" ? null : "not held for Apply"),
  },
  {
    say: ["also send the TB-3 to the delay"],
    check: (t) => sentWith(t, { source: "TB-3", destination: "Delay", mode: "add" }) ?? (sendCall(t)!.kind === "applied" ? null : "not applied"),
  },
  {
    say: ["send the 404 to the reverb at -10"],
    check: (t) => sentWith(t, { source: "SP-404 Mk2", destination: "Reverb", level_db: -10 }),
  },
  {
    say: ["send the P-6 to the P-6"],
    check: (t, s) => (s.writes.length ? `wrote ${s.writes.join(", ")}` : /loop|feed|itself|own/i.test(t.reply) ? null : "reply doesn't explain the loop"),
  },
  {
    say: ["put a delay on the TD-3"],
    check: (t) => {
      const c = t.calls.find((x) => x.name === "insert_fx");
      if (c?.input.source !== "TD-3-MO") return `expected insert_fx on TD-3-MO, got ${JSON.stringify(t.calls.map((x) => x.name))}`;
      return c.kind === "waiting" ? null : `plan ${c.kind}`;
    },
  },
  {
    say: ["make the reverb a plate"],
    check: (t, s) => (s.writes.length ? `wrote ${s.writes.join(", ")}` : /send|protect|in use|X32-Edit/i.test(t.reply) ? null : "reply doesn't say why"),
  },
  {
    say: ["give the reverb a 3 second tail"],
    check: (t) => {
      const c = t.calls.find((x) => x.name === "set_fx_param");
      const decay3 = c && /decay/i.test(String(c.input.param)) && Number(c.input.value) === 3;
      if (!decay3) return `got ${JSON.stringify(c?.input ?? t.calls.map((x) => x.name))}`;
      return c.kind === "applied" ? null : `plan ${c.kind}`;
    },
  },
  {
    say: ["what's going to the reverb?"],
    check: (t, s) => (s.writes.length ? "wrote something" : /TB-3/.test(t.reply) ? null : "reply doesn't name the TB-3"),
  },
  {
    say: ["also send the drums to the delay", "undo that"],
    check: (t, s) => {
      if (!t.calls.some((c) => c.name === "undo")) return "no undo call";
      return s.values.get("/ch/05/mix/03/level") === 0 ? null : "TR-8S still sent to the delay";
    },
  },
];

describe.skipIf(!LIVE)(`prompt check against ${MODEL}`, () => {
  it("handles the common phrases", { timeout: 300_000 }, async () => {
    const client = new Anthropic({ apiKey: apiKey() });
    const create: Create = async (r) => {
      try {
        return { message: await client.messages.create(r) };
      } catch (e) {
        return { error: (e as Error).message };
      }
    };
    let total = ZERO_USAGE;
    const problems: string[] = [];
    for (const c of CASES) {
      const s = session(create);
      let turn: Turn | null = null;
      for (const text of c.say) {
        turn = await s.say(text);
        total = addUsage(total, turn.usage);
      }
      const problem = turn!.error ?? c.check(turn!, s);
      const calls = turn!.calls.map((x) => `${x.name}(${JSON.stringify(x.input)}) → ${x.kind}`).join("; ") || "no tools";
      console.log(`${problem ? "FAIL" : "ok  "} "${c.say.join(" / ")}"\n     ${calls}\n     reply: ${turn!.reply}${problem ? `\n     problem: ${problem}` : ""}`);
      if (problem) problems.push(`"${c.say.at(-1)}": ${problem}`);
    }
    console.log(`\n${usageText(total, MODEL)}`);
    expect(problems).toEqual([]);
  });
});
