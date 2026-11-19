// Reading a list of addresses from the desk, a few at a time so a burst doesn't overrun it. Answers land in the cache
// through the client's message listener; addresses that go unanswered are reported as missing.

import type { Param } from "./addresses";
import type { DeskValue } from "./cache";

export interface ReadProgress {
  done: number;
  total: number;
  missing: string[]; // addresses the desk didn't answer
}

export interface Readable {
  read(param: Param): Promise<DeskValue>;
}

export const READ_WINDOW = 16; // reads in flight at once

export async function readAll(
  client: Readable,
  params: Param[],
  onProgress: (p: ReadProgress) => void = () => {},
  signal?: AbortSignal,
): Promise<ReadProgress> {
  const progress: ReadProgress = { done: 0, total: params.length, missing: [] };
  let next = 0;
  const worker = async () => {
    while (next < params.length && !signal?.aborted) {
      const param = params[next++]!;
      await client.read(param).catch(() => progress.missing.push(param.address));
      progress.done++;
      onProgress({ ...progress });
    }
  };
  await Promise.all(Array.from({ length: READ_WINDOW }, worker));
  return progress;
}
