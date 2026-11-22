// The one Operator the Sends panel and the chat share: plans, the plan waiting for Apply, and the undo stack. It is
// made again when the desk's address changes.

import { useCallback, useEffect, useMemo, useState } from "react";
import type { DeskCache } from "../core/cache";
import type { DeskClient } from "../core/client";
import { chatAllowed, Operator, type Outcome } from "../core/operator";
import { describeOutcome } from "../core/outcome";
import { Refused, type Plan, type PlanContext } from "../core/planner";
import { libraryNames } from "../core/library";
import { inLibrary, parsePresets, type Preset } from "../core/presets";
import { presetCatalogue } from "../desk/relay";
import type { Desk } from "../desk/useDesk";
import { studioFeeds, studioShared } from "./studioShared";

export interface Message {
  text: string;
  bad: boolean;
  kind: Outcome["kind"] | "refused" | "error" | "none";
}

interface Actions {
  // Plan and propose; returns what happened, in a sentence (also shown as the message).
  run: (make: (ctx: PlanContext) => Plan) => Promise<Message>;
  confirm: () => Promise<Message>;
  cancel: () => void;
  undo: () => Promise<Message>;
}

export interface Plans extends Actions {
  context: () => PlanContext;
  pending: Plan | null;
  lastApplied: Plan | null;
  message: Message | null;
  busy: boolean;
}

const BAD: Outcome["kind"][] = ["mismatch", "offline"];
const OFFLINE: Message = { text: "The desk isn't connected, so nothing was sent.", bad: true, kind: "offline" };

function makeOperator(client: DeskClient | null): Operator | null {
  if (!client) return null;
  const io = {
    read: client.read.bind(client), write: client.write.bind(client), request: client.request.bind(client),
    connected: () => client.link === "connected",
  };
  return new Operator(io, chatAllowed(studioShared));
}

// The catalogue matched to the desk's library as it is now (it can change in X32-Edit).
const contextOf = (cache: DeskCache, catalogue: Preset[]) => (): PlanContext => {
  const get = (a: string) => cache.get(a);
  return { get, shared: studioShared, feeds: studioFeeds, presets: inLibrary(catalogue, libraryNames(get)) };
};

function useCatalogue(): Preset[] {
  const [catalogue, setCatalogue] = useState<Preset[]>([]);
  useEffect(() => {
    void presetCatalogue().then((json) => setCatalogue(parsePresets(json)));
  }, []);
  return catalogue;
}

// Runs one operator call and turns its outcome, or the reason it was refused, into a message.
async function settled(work: () => Promise<Outcome | null>): Promise<Message> {
  try {
    const outcome = await work();
    if (!outcome) return { text: "Nothing to do.", bad: false, kind: "none" };
    return { text: describeOutcome(outcome), bad: BAD.includes(outcome.kind), kind: outcome.kind };
  } catch (e) {
    const refused = e instanceof Refused;
    return { text: refused ? e.message : `Error: ${(e as Error).message}`, bad: true, kind: refused ? "refused" : "error" };
  }
}

type Report = (work: () => Promise<Outcome | null>) => Promise<Message>;

function actionsFor(operator: Operator | null, context: () => PlanContext, report: Report): Actions {
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
  const catalogue = useCatalogue();
  const context = useMemo(() => contextOf(desk.cache, catalogue), [desk.cache, catalogue]);
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
    return m;
  }, []);
  const actions = useMemo(() => actionsFor(operator, context, report), [operator, context, report]);
  const cancel = useCallback(() => {
    actions.cancel();
    setMessage({ text: "Cancelled.", bad: false, kind: "none" });
  }, [actions]);

  const pending = operator ? operator.pending : null;
  const lastApplied = operator ? operator.lastApplied : null;
  return { ...actions, cancel, context, pending, lastApplied, message, busy };
}
