// Bank select + program change, optionally followed by a read: for measuring how soon after a program change the
// JV answers an RQ1 with the new patch.

import { useState } from "react";
import { sleep } from "../link/readPatch";
import type { JvLink } from "../link/useJvLink";

const BANKS: readonly { name: string; msb: number; lsb: number }[] = [
  { name: "USER", msb: 80, lsb: 0 },
  { name: "PR-A", msb: 81, lsb: 0 },
  { name: "PR-B", msb: 81, lsb: 1 },
  { name: "PR-C", msb: 81, lsb: 2 },
  { name: "GM", msb: 81, lsb: 3 },
  { name: "PR-E", msb: 81, lsb: 4 },
];

export function ProgramPanel({ link, read }: { link: JvLink; read: () => Promise<unknown> }) {
  const [bank, setBank] = useState(1);
  const [program, setProgram] = useState(1);
  const [delay, setDelay] = useState(300);
  const b = BANKS[bank]!;
  const ch = link.channel;

  const sendProgram = () => {
    link.send([0xb0 | ch, 0, b.msb], `bank MSB ${b.msb}`);
    link.send([0xb0 | ch, 32, b.lsb], `bank LSB ${b.lsb}`);
    link.send([0xc0 | ch, program - 1], `program ${b.name} ${program}`);
  };
  const sendAndRead = async () => {
    sendProgram();
    await sleep(delay);
    await read();
  };

  return (
    <section>
      <h2>Bank / program</h2>
      <div className="row">
        <select value={bank} onChange={(e) => setBank(Number(e.target.value))}>
          {BANKS.map((x, i) => <option key={x.name} value={i}>{x.name}</option>)}
        </select>
        <button onClick={() => setProgram((p) => Math.max(1, p - 1))}>‹</button>
        <input type="number" min={1} max={128} value={program} onChange={(e) => setProgram(Number(e.target.value))} />
        <button onClick={() => setProgram((p) => Math.min(128, p + 1))}>›</button>
        <button onClick={sendProgram}>SEND PC</button>
        <label>then read after <input type="number" min={0} step={50} value={delay} onChange={(e) => setDelay(Number(e.target.value))} /> ms</label>
        <button onClick={() => void sendAndRead()}>SEND PC + READ</button>
      </div>
    </section>
  );
}
