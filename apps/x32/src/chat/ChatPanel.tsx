// Chat (docs/x32-spec.md, phase 4): type a request, the model plans it through the same tools as the Sends panel, and
// a plan that needs confirming waits here for Apply.

import { useEffect, useRef, useState } from "react";
import { usageText } from "../core/usage";
import { PlanView } from "../plans/PlanView";
import type { Chat, ChatItem } from "./useChat";

const WHO: Record<ChatItem["who"], string> = { you: "You", model: "X32", tool: "Plan", note: "" };

function Transcript({ items }: { items: ChatItem[] }) {
  const end = useRef<HTMLLIElement>(null);
  useEffect(() => {
    end.current?.scrollIntoView({ block: "nearest" });
  }, [items]);
  if (!items.length) return <p className="note">Try “route S-1 to the P-6”, “also send the TB-3 to the reverb” or “what goes to the Sampler?”</p>;
  return (
    <ol className="transcript">
      {items.map((item, i) => (
        <li key={i} className={`${item.who} ${item.bad ? "bad" : ""}`}>
          {WHO[item.who] && <span className="who">{WHO[item.who]}</span>} {item.text}
        </li>
      ))}
      <li ref={end} className="end" />
    </ol>
  );
}

function NoKey({ chat }: { chat: Chat }) {
  const k = chat.status!.keychain;
  return (
    <p className="note">
      There's no API key yet. Add one to the Keychain in Terminal, then start a new chat:{" "}
      <code className="mono">security add-generic-password -s "{k.service}" -a {k.account} -w</code>
    </p>
  );
}

function Composer({ chat, connected }: { chat: Chat; connected: boolean }) {
  const [text, setText] = useState("");
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const typed = text.trim();
    if (!typed) return;
    setText("");
    void chat.send(typed);
  };
  return (
    <form className="composer" onSubmit={submit}>
      <input value={text} onChange={(e) => setText(e.target.value)} placeholder={connected ? "Ask for a routing change" : "Waiting for the desk"} aria-label="Message" />
      <button type="submit" disabled={chat.busy || !connected || !text.trim()}>{chat.busy ? "Thinking…" : "Send"}</button>
    </form>
  );
}

export function ChatPanel({ chat, connected }: { chat: Chat; connected: boolean }) {
  const ready = chat.status?.ready;
  return (
    <section className="panel chat">
      <header>
        <h1>Chat</h1>
        <span className="dim usage">{chat.status?.model} · {usageText(chat.usage, chat.status?.model ?? "")}</span>
        <button type="button" onClick={chat.newChat} disabled={chat.busy}>New chat</button>
      </header>
      {chat.status && !ready && <NoKey chat={chat} />}
      <Transcript items={chat.items} />
      <PlanView plans={chat.plans} />
      {ready && <Composer chat={chat} connected={connected} />}
    </section>
  );
}
