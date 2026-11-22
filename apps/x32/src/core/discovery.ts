// Finding the desk on the network: the app broadcasts /xinfo to port 10023 (electron/main.cjs) and every X32 answers
// with its address, name, model and firmware. The main process only moves bytes; the answers are read here.

import { decodePacket, encodeMessage } from "./osc";

export interface FoundDesk {
  host: string; // where the answer came from, as "address:port" (the form the app shows and connects to)
  name: string; // the desk's network name, e.g. "X32RACK-0E-1C-B1"
  model: string;
  firmware: string;
}

export interface DiscoveryReply {
  from: string; // "address:port" of the sender
  bytes: Uint8Array;
}

export const XINFO = encodeMessage("/xinfo");

function readReply(reply: DiscoveryReply): FoundDesk | null {
  const m = decodePacket(reply.bytes).find((x) => x.address === "/xinfo");
  const [, name, model, firmware] = (m?.args ?? []).map((a) => String(a.value));
  return model ? { host: reply.from, name: name ?? "", model, firmware: firmware ?? "" } : null;
}

// One entry per desk: it answers each broadcast address it hears, so the same desk often replies more than once.
export function foundDesks(replies: DiscoveryReply[]): FoundDesk[] {
  const byHost = new Map<string, FoundDesk>();
  for (const r of replies) {
    const desk = readReply(r);
    if (desk && !byHost.has(desk.host)) byHost.set(desk.host, desk);
  }
  return [...byHost.values()];
}
