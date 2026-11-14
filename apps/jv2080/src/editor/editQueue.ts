// Copied from apps/tb3/src/editor/editQueue.ts.
// Coalesces outgoing edits: one pending message per key (last value wins), flushed once per
// scheduled tick. A fast drag therefore sends at most one DT1 per param per frame, and the
// final value is always sent.

export type Schedule = (flush: () => void) => void;

export interface EditQueue {
  push(key: string, msg: number[]): void;
  flush(): void;
}

const rafSchedule: Schedule = (flush) => requestAnimationFrame(flush);

export function createEditQueue(send: (msg: number[]) => void, schedule: Schedule = rafSchedule): EditQueue {
  const pending = new Map<string, number[]>();
  let scheduled = false;
  const flush = () => {
    scheduled = false;
    const msgs = [...pending.values()];
    pending.clear();
    msgs.forEach(send);
  };
  return {
    push(key, msg) {
      pending.set(key, msg);
      if (!scheduled) {
        scheduled = true;
        schedule(flush);
      }
    },
    flush,
  };
}
