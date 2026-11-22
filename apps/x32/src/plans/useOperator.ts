// The one Operator the Sends panel and the chat share: plans, the plan waiting for Apply, and the undo stack. It is
// made again when the desk's address changes.

import { useCallback, useEffect, useMemo, useState } from "react";
import type { DeskCache } from "../core/cache";
import type { DeskClient } from "../core/client";
import { chatAllowed, Operator, type Outcome } from "../core/operator";
import { describeOutcome } from "../core/outcome";
import { Refused, type Plan, type PlanContext } from "../core/planner";
import type { Desk } from "../desk/useDesk";
import { studioShared } from "./studioShared";

export interface Message {
  text: string;
  bad: boolean;
}

interface Actions {
  // Plan and propose; returns what happened, in a sentence (also shown as the message).
  run: (make: (ctx: PlanContext) => Plan) => Promise<string>;
  confirm: () => Promise<string>;
  cancel: () => void;
  undo: () => Promise<string>;
}

export interface Plans extends Actions {
  context: () => PlanContext;
  pending: Plan | null;
  lastApplied: Plan | null;
  message: Message | null;
  busy: boolean;
}

const BAD: Outcome["kind"][] = ["mismatch", "offline"];
const OFFLINE = "The desk isn't connected, so nothing was sent.";

function makeOperator(client: DeskClient | null): Operator | null {
  if (!client) return null;
  const io = { read: client.read.bind(client), write: client.write.bind(client), connected: () => client.link === "connected" };
  return new Operator(io, chatAllowed(studioShared));
}

const contextOf = (cache: DeskCache) => (): PlanContext => ({ get: (a) => cache.get(a), shared: studioShared });

// Runs one operator call and turns its outcome, or the reason it was refused, into a message.
async function settled(work: () => Promise<Outcome | null>): Promise<Message> {
  try {
    const outcome = await work();
    if (!outcome) return { text: "Nothing to do.", bad: false };
    return { text: describeOutcome(outcome), bad: BAD.includes(outcome.kind) };
  } catch (e) {
    return { text: e instanceof Refused ? e.message : `Error: ${(e as Error).message}`, bad: true };
  }
}

function actionsFor(operator: Operator | null, context: () => PlanContext, report: (work: () => Promise<Outcome | null>) => Promise<string>): Actions {
  if (!operator) return { run: async () => OFFLINE, confirm: async () => OFFLINE, undo: async () => OFFLINE, cancel: () => {} };
  return {
    run: (make) => report(async () => operator.propose(make(context()))),
    confirm: () => report(() => operator.confirm()),
    undo: () => report(() => operator.undo(context())),
    cancel: () => operator.cancel(),
  };
}

export function useOperator(desk: Desk): Plans {
  const operator = useMemo(() => makeOperator(desk.client), [desk.client]);
  const context = useMemo(() => contextOf(desk.cache), [desk.cache]);
  const [, setTick] = useState(0);
  const [message, setMessage] = useState<Message | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => operator?.onChange(() => setTick((t) => t + 1)), [operator]);
  useEffect(() => setMessage(null), [operator]);

  const report = useCallback(async (work: () => Promise<Outcome | null>) => {
    setBusy(true);
    const m = await settled(work);
    setMessage(m);
    setBusy(false);
    return m.text;
  }, []);
  const actions = useMemo(() => actionsFor(operator, context, report), [operator, context, report]);
  const cancel = useCallback(() => {
    actions.cancel();
    setMessage({ text: "Cancelled.", bad: false });
  }, [actions]);

  const pending = operator ? operator.pending : null;
  const lastApplied = operator ? operator.lastApplied : null;
  return { ...actions, cancel, context, pending, lastApplied, message, busy };
}
