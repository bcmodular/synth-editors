// Serial half of the Phase 0 spike: connect, poll status, read pads, set level / pan / bank volume, and send
// read-only raw commands, with every byte logged to a capture file.

import { useState, type KeyboardEvent } from "react";
import type { MixField } from "../core/mixer";
import { noteName, padNote } from "../core/padNotes";
import type { PadBlock } from "../core/serialMessages";
import type { SerialSession } from "./useSerial";

const BANKS = "ABCDEFGHIJ";
const padLabel = (pad: number) => `${BANKS[Math.floor(pad / 16)]}${(pad % 16) + 1}`;
const EDITABLE: readonly MixField[] = ["level", "pan", "routing", "muteGroup", "attack", "hold", "release"];

// A number box that sends its value on Enter.
function ValueBox({ value, onSend }: { value: number; onSend: (v: number) => void }) {
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") onSend(Number(e.currentTarget.value));
  };
  return <input className="num" type="number" defaultValue={value} onKeyDown={onKeyDown} />;
}

function PadRow({ block, serial }: { block: PadBlock; serial: SerialSession }) {
  const note = padNote(block.pad);
  return (
    <tr>
      <td>{padLabel(block.pad)}</td>
      <td className="name">{block.name}</td>
      {EDITABLE.map((f) => (
        <td key={f}><ValueBox value={block.mix[f]} onSend={(v) => serial.setPadValue(block.pad, f, v)} /></td>
      ))}
      <td>{note ? `${note.channel} · ${noteName(note.note)}` : "–"}</td>
    </tr>
  );
}

function StatusLine({ serial }: { serial: SerialSession }) {
  const s = serial.status;
  if (!s) return <p className="dim">No status yet</p>;
  const playing = s.playingFrames === undefined ? "nothing" : `${s.playingFrames} frames`;
  return (
    <p>
      Project {s.project + 1} · selected bank {BANKS[s.selectedBank] ?? s.selectedBank} · pad byte {s.selectedPad} ·
      playing: {playing}
    </p>
  );
}

function RawSend({ serial }: { serial: SerialSession }) {
  const [text, setText] = useState("FD 00 00");
  const [long, setLong] = useState(false);
  return (
    <div className="row">
      <input className="wide" value={text} onChange={(e) => setText(e.target.value)} />
      <label><input type="checkbox" checked={long} onChange={(e) => setLong(e.target.checked)} /> long</label>
      <button onClick={() => serial.sendRaw(text, long)}>Send raw</button>
    </div>
  );
}

function NoteBox({ serial }: { serial: SerialSession }) {
  const [text, setText] = useState("");
  const add = () => {
    if (text) serial.note(text);
    setText("");
  };
  return (
    <div className="row">
      <input className="wide" placeholder="Note in the capture, e.g. 'now holding pad A3'" value={text}
        onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} />
      <button onClick={add}>Add note</button>
    </div>
  );
}

function BankVolume({ serial }: { serial: SerialSession }) {
  const [bank, setBank] = useState(0);
  return (
    <div className="row">
      Bank volume
      <select value={bank} onChange={(e) => setBank(Number(e.target.value))}>
        {[...BANKS].map((b, i) => <option key={b} value={i}>{b}</option>)}
      </select>
      <ValueBox value={127} onSend={(v) => serial.setBankVolume(bank, v)} />
    </div>
  );
}

function Controls({ serial }: { serial: SerialSession }) {
  if (!serial.connected) return <button onClick={serial.connect}>Connect SP-404 serial</button>;
  return (
    <div className="row">
      <button onClick={serial.disconnect}>Disconnect</button>
      <button onClick={serial.pollOnce}>Poll once</button>
      <label>
        <input type="checkbox" checked={serial.polling} onChange={(e) => serial.setPolling(e.target.checked)} />
        Poll every 500 ms
      </label>
      <button onClick={serial.readPads}>Read all pads</button>
      <button onClick={serial.reveal}>Show capture file</button>
    </div>
  );
}

export function SerialPanel({ serial }: { serial: SerialSession }) {
  return (
    <section>
      <h2>Serial</h2>
      <Controls serial={serial} />
      {serial.error && <p className="error">{serial.error}</p>}
      <StatusLine serial={serial} />
      {serial.connected && <><BankVolume serial={serial} /><RawSend serial={serial} /></>}
      <NoteBox serial={serial} />
      <table>
        <thead>
          <tr><th>Pad</th><th>Name</th>{EDITABLE.map((f) => <th key={f}>{f}</th>)}<th>Mode B note</th></tr>
        </thead>
        <tbody>{serial.pads.map((b) => <PadRow key={b.pad} block={b} serial={serial} />)}</tbody>
      </table>
      <pre className="log">{serial.lines.slice(-80).join("\n")}</pre>
    </section>
  );
}
