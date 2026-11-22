// What happened to a plan, in a sentence, for the Sends panel and the chat (and the model, as a tool result).

import type { Outcome } from "./operator";
import { show } from "./setupPlan";

export function describeOutcome(o: Outcome): string {
  switch (o.kind) {
    case "applied":
      return `Done: ${o.plan.summary} (${o.result.written} ${o.result.written === 1 ? "value" : "values"}, all read back).`;
    case "nothing":
      return `Nothing to change: ${o.plan.summary} is already so.`;
    case "waiting":
      return `Waiting for you to confirm: ${o.plan.summary}. ${o.plan.confirm}.`;
    case "mismatch": {
      const { change, got } = o.mismatch;
      return `Stopped: ${change.what} reads back as ${show(got, change.param.type)}, not ${show(change.value, change.param.type)}.`;
    }
    case "offline":
      return "The desk isn't reachable, so nothing was sent.";
  }
}
