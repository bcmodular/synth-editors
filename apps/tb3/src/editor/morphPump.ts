// Rate-limited morph sends. A fast move between patches that differ a lot can otherwise flood the
// TB-3 until it stops playing, so the editor follows the fader at once and the TB-3 catches up at a
// capped rate in changed bytes per second, latest values only. Sends come from a token bucket;
// rotating `cursor` keeps one busy block from starving the others.
import { applyRun, morphRuns } from "../core/patch";
import type { ByteRun, Patch } from "../core/patch";

export const PUMP_MS = 20;
const BURST_S = 0.2; // the bucket holds at most this many seconds of budget

export interface Bucket {
  tokens: number;
  last: number; // time of the last refill, ms
  cursor: number;
}

export const emptyBucket = (now: number): Bucket => ({ tokens: 0, last: now, cursor: 0 });

export interface PumpStep {
  runs: ByteRun[]; // to send now, in order
  sent: Patch; // what the TB-3 holds once they are sent
  bucket: Bucket;
  done: boolean; // the TB-3 already held `target`
}

const refill = (b: Bucket, rate: number, cap: number, now: number): number =>
  Math.min(cap, b.tokens + ((now - b.last) / 1000) * rate);

// Whole blocks first, in order; then the byte runs, starting from the cursor.
function sendOrder(runs: ByteRun[], cursor: number): { order: ByteRun[]; wholeCount: number; partCount: number } {
  const whole = runs.filter((r) => r.whole);
  const parts = runs.filter((r) => !r.whole);
  const rotated = parts.map((_, n) => parts[(cursor + n) % parts.length]!);
  return { order: [...whole, ...rotated], wholeCount: whole.length, partCount: parts.length };
}

// The cap in bytes per second, and the time now in ms.
export interface Pace {
  rate: number;
  now: number;
}

// One tick: which runs the bucket allows from `from` (what the TB-3 holds) towards `target`.
export function pumpStep(from: Patch, target: Patch, bucket: Bucket, { rate, now }: Pace): PumpStep {
  const cap = Math.max(1, rate * BURST_S);
  let tokens = refill(bucket, rate, cap, now);
  const runs = morphRuns(from, target);
  if (!runs.length) return { runs: [], sent: target, bucket: { ...bucket, tokens, last: now }, done: true };
  const { order, wholeCount, partCount } = sendOrder(runs, bucket.cursor);
  let cursor = bucket.cursor;
  let sent = from;
  let n = 0;
  // A run bigger than the whole bucket still goes once the bucket is full.
  for (; n < order.length && tokens >= Math.min(order[n]!.data.length, cap); n++) {
    sent = applyRun(sent, order[n]!);
    tokens -= order[n]!.data.length;
  }
  if (n < order.length && partCount) cursor = (cursor + Math.max(0, n - wholeCount)) % partCount;
  return { runs: order.slice(0, n), sent, bucket: { tokens, last: now, cursor }, done: false };
}
