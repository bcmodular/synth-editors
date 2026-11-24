// The chat's state (docs/x32-spec.md, phase 4): one conversation per app run, the transcript, the running cost, and the
// chat log. Plans go through the same operator as the Sends panel; Apply, Cancel and Undo pressed in the chat are told
// to the model with the next message and logged.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Conversation, type Turn, type Usage } from "../core/agent";
import { deskKind, requestEntry, rigHash, type ChatEntry } from "../core/chatLog";
import { checkOutcome } from "../core/pathCheck";
import { presetsText } from "../core/presets";
import { rigSummary } from "../core/rigSummary";
import type { ToolHost } from "../core/tools";
import { addUsage, ZERO_USAGE } from "../core/usage";
import type { Desk } from "../desk/useDesk";
import { studioShared } from "../plans/studioShared";
import type { Message, Plans } from "../plans/useOperator";
import { claudeStatus, createMessage, logChat, type ClaudeStatus } from "./relay";

export interface ChatItem {
  who: "you" | "model" | "tool" | "note";
  text: string;
  bad?: boolean;
}

export interface Chat {
  status: ClaudeStatus | null;
  items: ChatItem[];
  busy: boolean;
  usage: Usage;
  send: (text: string) => Promise<void>;
  newChat: () => void;
  plans: Plans; // the operator, with Apply, Cancel and Undo noted for the model and the log
}

const toolItems = (turn: Turn): ChatItem[] =>
  turn.calls.filter((c) => c.name !== "get_state").map((c) => ({ who: "tool", text: c.result.split(" Nothing is written yet")[0]!, bad: c.kind === "refused" }));

function turnItems(turn: Turn): ChatItem[] {
  const reply: ChatItem[] = turn.reply ? [{ who: "model", text: turn.reply }] : [];
  const error: ChatItem[] = turn.error ? [{ who: "note", text: turn.error, bad: true }] : [];
  return [...toolItems(turn), ...reply, ...error];
}

// Notes for the model about what the user did with the buttons since its last turn.
const withNotes = (text: string, notes: string[]) => (notes.length ? `(Since your last reply: ${notes.join(" ")})\n${text}` : text);

// The tools' view of the app. It reads the latest operator through a ref, so the conversation isn't made again on
// every render.
function useHost(desk: Desk, plans: Plans): ToolHost {
  const latest = useRef(plans);
  latest.current = plans;
  return useMemo(() => ({
    state: (names: string[]) => rigSummary({ get: (a) => desk.cache.get(a), shared: studioShared, names }),
    presets: (query: string) => presetsText(latest.current.context().presets ?? [], query),
    check: (req) => checkOutcome(latest.current.context(), req),
    run: async (make) => latest.current.run(make),
    undo: async () => latest.current.undo(),
  }), [desk.cache]);
}

export function useChat(desk: Desk, plans: Plans): Chat {
  const [status, setStatus] = useState<ClaudeStatus | null>(null);
  const [items, setItems] = useState<ChatItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [usage, setUsage] = useState<Usage>(ZERO_USAGE);
  const [notes, setNotes] = useState<string[]>([]);
  const host = useHost(desk, plans);
  const model = status?.model ?? "";
  const [conversation, setConversation] = useState<Conversation | null>(null);
  useEffect(() => void claudeStatus().then(setStatus), []);
  useEffect(() => setConversation(model ? new Conversation({ model, create: createMessage, host }) : null), [model, host]);

  const summary = useCallback(() => rigSummary({ get: (a) => desk.cache.get(a), shared: studioShared }), [desk.cache]);
  const base = useCallback((): Pick<ChatEntry, "time" | "desk" | "rig"> =>
    ({ time: new Date().toISOString(), desk: deskKind(desk.host), rig: rigHash(summary()) }), [desk.host, summary]);
  const add = (more: ChatItem[]) => setItems((all) => [...all, ...more]);

  const send = useCallback(async (typed: string) => {
    if (!conversation || busy) return;
    add([{ who: "you", text: typed }]);
    setBusy(true);
    const started = performance.now();
    const turn = await conversation.send(withNotes(typed, notes), summary());
    const latencyMs = Math.round(performance.now() - started);
    setNotes([]);
    setUsage((u) => addUsage(u, turn.usage));
    add(turnItems(turn));
    setBusy(false);
    void logChat(requestEntry(base(), { typed, model, turn, latencyMs }));
  }, [conversation, busy, notes, summary, base, model]);

  const newChat = useCallback(() => {
    void claudeStatus().then(setStatus); // a key added since is picked up
    setConversation(new Conversation({ model, create: createMessage, host }));
    setItems([]);
    setNotes([]);
  }, [model, host]);

  // The operator's buttons, noted for the model and the log.
  const noted = useCallback((kind: ChatEntry["kind"], done: Message) => {
    add([{ who: "note", text: done.text, bad: done.bad }]);
    setNotes((n) => [...n, `the user pressed ${kind === "apply" ? "Apply" : kind === "undo" ? "Undo" : "Cancel"}: ${done.text}`]);
    void logChat({ ...base(), kind, outcome: done.text });
    return done;
  }, [base]);
  const chatPlans = useMemo<Plans>(() => ({
    ...plans,
    confirm: async () => noted("apply", await plans.confirm()),
    undo: async () => noted("undo", await plans.undo()),
    cancel: () => {
      plans.cancel();
      noted("cancel", { text: "Cancelled.", bad: false, kind: "none" });
    },
  }), [plans, noted]);

  return { status, items, busy, usage, send, newChat, plans: chatPlans };
}
