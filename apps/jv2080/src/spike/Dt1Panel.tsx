// Single-parameter DT1s. Tone 1 Reverb Send is at tone offset 128, which tests the address carry (03 00 11 00).

import { useState } from "react";
import { PATCH_BLOCKS } from "../core/patch";
import { addOffset, addrHex, dt1, type Address } from "../core/sysex";
import type { JvLink } from "../link/useJvLink";

interface TestParam {
  label: string;
  block: number;
  offset: number;
}

const PARAMS: readonly TestParam[] = [
  { label: "Patch Level", block: 0, offset: 0x2e },
  { label: "Tone 1 Cutoff", block: 1, offset: 0x51 },
  { label: "Tone 1 Reverb Send", block: 1, offset: 128 },
];

function ParamSlider({ link, param, value, onChange }: {
  link: JvLink;
  param: TestParam;
  value: number;
  onChange: (block: number, offset: number, value: number) => void;
}) {
  const addr: Address = addOffset(PATCH_BLOCKS[param.block]!.addr, param.offset);
  const set = (v: number) => {
    onChange(param.block, param.offset, v);
    link.send(dt1(addr, [v], link.device), `DT1 ${param.label} = ${v}`);
  };
  return (
    <div className="row">
      <span className="lbl">{param.label}</span>
      <code className="dim">{addrHex(addr)}</code>
      <input type="range" min={0} max={127} value={value} onChange={(e) => set(Number(e.target.value))} />
      <span className="val">{value}</span>
    </div>
  );
}

export function Dt1Panel({ link, valueOf, onChange }: {
  link: JvLink;
  valueOf: (block: number, offset: number) => number;
  onChange: (block: number, offset: number, value: number) => void;
}) {
  const [, redraw] = useState(0);
  const change = (block: number, offset: number, value: number) => {
    onChange(block, offset, value);
    redraw((n) => n + 1);
  };
  return (
    <section>
      <h2>Send one parameter (DT1)</h2>
      {PARAMS.map((p) => <ParamSlider key={p.label} link={link} param={p} value={valueOf(p.block, p.offset)} onChange={change} />)}
    </section>
  );
}
