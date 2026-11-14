// Reads the temporary patch block by block: one RQ1, then wait until every byte of that block has arrived (the JV
// answers a tone in more than one DT1) or a timeout. Logs how many packets each block took and how long.

import { blockComplete, PATCH_BLOCKS, placeDt1, receivedCount, type PatchBuffer } from "../core/patch";
import { parseDt1, rq1 } from "../core/sysex";
import type { JvLink } from "./useJvLink";

const BLOCK_TIMEOUT_MS = 1000;
export const BULK_GAP_MS = 25; // ≥ 20 ms between bulk packets (manual p.187)

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type ReadLink = Pick<JvLink, "send" | "subscribe" | "note" | "device">;

// The block being waited for: counts its packets and resolves once it is complete.
class BlockWait {
  packets = 0;
  private resolve = () => {};
  readonly arrived = new Promise<void>((r) => (this.resolve = r));
  constructor(readonly block: number) {}
  packetFor(block: number, complete: boolean) {
    if (block !== this.block) return;
    this.packets++;
    if (complete) this.resolve();
  }
}

// Places every DT1 that arrives into the patch and reports it to the current wait.
function placeIncoming(link: ReadLink, patch: PatchBuffer, onUpdate: () => void, current: () => BlockWait | null) {
  return (msg: number[]) => {
    const dt = parseDt1(msg);
    if (!dt) return;
    if (!dt.checksumOk) link.note("checksum error in the DT1 above");
    const placed = placeDt1(patch, dt.addr, dt.data);
    if (!placed) return;
    onUpdate();
    current()?.packetFor(placed.block, blockComplete(patch, placed.block));
  };
}

async function readBlock(link: ReadLink, patch: PatchBuffer, wait: BlockWait): Promise<boolean> {
  const def = PATCH_BLOCKS[wait.block]!;
  const start = performance.now();
  link.send(rq1(def.addr, def.size, link.device), `RQ1 ${def.name}`);
  await Promise.race([wait.arrived, sleep(BLOCK_TIMEOUT_MS)]);
  const ms = Math.round(performance.now() - start);
  link.note(`${def.name}: ${receivedCount(patch, wait.block)}/${def.size} bytes in ${wait.packets} packet(s), ${ms} ms`);
  return blockComplete(patch, wait.block);
}

export async function readPatch(link: ReadLink, patch: PatchBuffer, onUpdate: () => void): Promise<boolean> {
  let wait: BlockWait | null = null;
  const unsubscribe = link.subscribe(placeIncoming(link, patch, onUpdate, () => wait));
  try {
    for (let block = 0; block < PATCH_BLOCKS.length; block++) {
      wait = new BlockWait(block);
      if (!(await readBlock(link, patch, wait))) return false;
    }
    return true;
  } finally {
    unsubscribe();
  }
}

export async function sendPaced(link: Pick<JvLink, "send">, messages: number[][], label: string) {
  for (const [i, m] of messages.entries()) {
    if (i > 0) await sleep(BULK_GAP_MS);
    link.send(m, `${label} ${i + 1}/${messages.length}`);
  }
}
