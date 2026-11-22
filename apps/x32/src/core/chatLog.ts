// Chat log entries (docs/x32-spec.md, "Chat log"): one per request, so the common requests can become buttons later
// and the prompt check has real phrases. Never the API key, the system prompt, the tools or the full desk state: a
// short hash of the rig stands in for it.

import type { ToolCall, Turn } from "./agent";

export interface ChatEntry {
  time: string;
  desk: "fake" | "real";
  kind: "request" | "apply" | "cancel" | "undo";
  typed?: string;
  model?: string;
  calls?: Pick<ToolCall, "name" | "input" | "kind" | "result">[];
  reply?: string;
  error?: string | null;
  rounds?: number;
  tokens?: Turn["usage"];
  latencyMs?: number;
  outcome?: string; // apply, cancel, undo: what happened
  rig: string; // hash of the rig summary
}

// FNV-1a, 32 bits, as hex: enough to see that the desk's names changed between entries.
export function rigHash(summary: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < summary.length; i++) h = Math.imul(h ^ summary.charCodeAt(i), 0x01000193);
  return (h >>> 0).toString(16).padStart(8, "0");
}

// 127.0.0.1 and localhost are the fake desk (npm run fake:x32); anything else is the real one.
export const deskKind = (host: string): ChatEntry["desk"] => (/^(127\.0\.0\.1|localhost)(:|$)/.test(host) ? "fake" : "real");

export interface RequestLog {
  typed: string;
  model: string;
  turn: Turn;
  latencyMs: number;
}

export function requestEntry(base: Pick<ChatEntry, "time" | "desk" | "rig">, r: RequestLog): ChatEntry {
  const { turn } = r;
  return {
    ...base, kind: "request", typed: r.typed, model: r.model, reply: turn.reply, error: turn.error, rounds: turn.rounds,
    tokens: turn.usage, latencyMs: r.latencyMs, calls: turn.calls.map(({ name, input, kind, result }) => ({ name, input, kind, result })),
  };
}
