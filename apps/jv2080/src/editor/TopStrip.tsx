// Title, MIDI ports, sync with the JV, and the bank browser (bank select + program change, then read the patch).

import type { PortInfo } from "@synth-editors/midi";
import { useState, type ReactNode } from "react";
import { BANKS, PATCHES_PER_BANK } from "../core/banks";
import { patchName } from "../core/patch";
import type { JvLink } from "../link/useJvLink";
import type { JvSession } from "./useJvSession";

function PortSelect(p: { label: string; ports: PortInfo[]; value: string; onChange: (v: string) => void }) {
  return (
    <label className="port">
      {p.label}
      <select className="pick" value={p.value} onChange={(e) => p.onChange(e.target.value)}>
        <option value="">(choose)</option>
        {p.ports.map((port) => <option key={port.id} value={port.name}>{port.name}</option>)}
      </select>
    </label>
  );
}

function BankBrowser({ session }: { session: JvSession }) {
  const [bank, setBank] = useState(1);
  const [number, setNumber] = useState(1);
  const go = (n: number) => {
    const next = ((n - 1 + PATCHES_PER_BANK) % PATCHES_PER_BANK) + 1;
    setNumber(next);
    void session.loadFromBank(BANKS[bank]!, next);
  };
  return (
    <div className="row tight bank">
      <span className="lbl">JV BANK</span>
      <select className="pick" value={bank} onChange={(e) => setBank(Number(e.target.value))}>
        {BANKS.map((b, i) => <option key={b.name} value={i}>{b.name}</option>)}
      </select>
      <input
        className="pick num"
        type="number"
        min={1}
        max={PATCHES_PER_BANK}
        value={number}
        onChange={(e) => setNumber(Math.max(1, Math.min(PATCHES_PER_BANK, Number(e.target.value) || 1)))}
      />
      <button className="btn" disabled={session.busy} onClick={() => go(number - 1)}>‹</button>
      <button className="btn" disabled={session.busy} onClick={() => go(number + 1)}>›</button>
      <button className="btn" disabled={session.busy} onClick={() => go(number)}>LOAD</button>
    </div>
  );
}

export function TopStrip(p: { link: JvLink; session: JvSession; onSpike: () => void; settings: ReactNode }) {
  const { link, session } = p;
  return (
    <header className="top">
      <h1>JV-2080</h1>
      <span className="name">{session.patch ? patchName(session.patch) : "—"}</span>
      {p.settings}
      <PortSelect label="OUT" ports={link.outputs} value={link.outName} onChange={link.setOutName} />
      <PortSelect label="IN" ports={link.inputs} value={link.inName} onChange={link.setInName} />
      <button className="btn" disabled={session.busy} onClick={() => void session.syncFromJv()}>SYNC FROM JV</button>
      <button className="btn" disabled={session.busy || !session.patch} onClick={() => void session.syncToJv()}>SYNC TO JV</button>
      <BankBrowser session={session} />
      <button className="btn spike-btn" onClick={p.onSpike}>SPIKE</button>
    </header>
  );
}
