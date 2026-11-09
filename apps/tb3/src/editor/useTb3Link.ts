// What the TB-3 holds, and how it is brought in line. The TB-3's state is tracked in `sent`: every
// recall, preview and morph sends only the blocks that differ from it. Edits send single params
// through the edit queue. Morph sends go through the rate-limited pump (morphPump.ts).
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { blocksToSysex, diffBlocks, patchToSysex, runToSysex } from "../core/patch";
import type { Patch } from "../core/patch";
import { createEditQueue } from "./editQueue";
import { PUMP_MS, emptyBucket, pumpStep } from "./morphPump";
import { persistRate, restoreRate } from "./sessionPersist";
import type { Tb3Sender } from "./pacer";

export function useTb3Link(tb3: Tb3Sender) {
  const queue = useMemo(() => createEditQueue(tb3.send), [tb3]);
  const sent = useRef<Patch | null>(null); // what the TB-3 holds; null = unknown
  const pumpTarget = useRef<Patch | null>(null); // latest morph blend still to reach the TB-3

  // Bring the TB-3 in line with `target`, sending only the blocks that differ.
  const sendPatch = useCallback(
    (target: Patch) => {
      queue.flush();
      pumpTarget.current = null; // a full send supersedes any morph catch-up
      const keys = sent.current ? diffBlocks(sent.current, target) : null;
      (keys ? blocksToSysex(target, keys) : patchToSysex(target)).forEach(tb3.send);
      sent.current = target;
    },
    [queue, tb3],
  );

  // Send every block, whatever the TB-3 is thought to hold.
  const sendAll = useCallback(
    (target: Patch) => {
      sent.current = null;
      sendPatch(target);
    },
    [sendPatch],
  );

  // An edit to `cur` makes `next`: first bring the TB-3 in line if it doesn't hold `cur` yet (after
  // startup or a preview), then send `msg` (coalesced by `key`).
  const sendEdit = useCallback(
    (cur: Patch, next: Patch, key: string, msg: number[]) => {
      if (sent.current !== cur) sendPatch(cur);
      sent.current = next;
      queue.push(key, msg);
    },
    [queue, sendPatch],
  );

  // The TB-3 was read back and holds `p`.
  const holds = useCallback((p: Patch) => {
    sent.current = p;
  }, []);

  const pump = useMorphPump({ tb3, sent, pumpTarget, sendPatch, flushEdits: queue.flush });

  return { push: queue.push, sendPatch, sendAll, sendEdit, holds, ...pump };
}

interface PumpDeps {
  tb3: Tb3Sender;
  sent: { current: Patch | null };
  pumpTarget: { current: Patch | null };
  sendPatch: (p: Patch) => void;
  flushEdits: () => void;
}

function useMorphPump({ tb3, sent, pumpTarget, sendPatch, flushEdits }: PumpDeps) {
  const [morphRate, setMorphRateState] = useState(restoreRate);
  const rate = useRef(morphRate);
  const timer = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const bucket = useRef(emptyBucket(0));

  const stop = useCallback(() => {
    clearInterval(timer.current);
    timer.current = undefined;
  }, []);

  const tick = useCallback(() => {
    const target = pumpTarget.current;
    const from = sent.current;
    if (!target) return stop();
    if (!from) {
      sendPatch(target); // TB-3 state unknown: one full send
      return stop();
    }
    if (tb3.backlog() > PUMP_MS) return; // still sending the last tick's runs: catch up from here next time
    const step = pumpStep(from, target, bucket.current, { rate: rate.current, now: performance.now() });
    step.runs.forEach((run) => tb3.send(runToSysex(run)));
    bucket.current = step.bucket;
    sent.current = step.sent; // caught up: keeps identity with `target`, so edits don't resend
    if (step.done) {
      pumpTarget.current = null;
      stop();
    }
  }, [pumpTarget, sent, sendPatch, tb3, stop]);

  // Send the TB-3 towards `p` at the capped rate.
  const pumpTo = useCallback(
    (p: Patch) => {
      pumpTarget.current = p;
      if (timer.current !== undefined) return;
      flushEdits();
      bucket.current = { ...bucket.current, last: performance.now() };
      tick(); // send what the bucket allows straight away
      if (pumpTarget.current) timer.current = setInterval(tick, PUMP_MS);
    },
    [flushEdits, pumpTarget, tick],
  );

  const setMorphRate = useCallback((r: number) => {
    rate.current = r;
    setMorphRateState(r);
    persistRate(r);
  }, []);

  useEffect(() => stop, [stop]);

  return { morphRate, setMorphRate, pumpTo };
}
