// Tries something again while its result says to, a few times with a pause between: the H12 takes a few seconds
// after power-up before it answers SysEx, though its ports appear at once.

export interface Retries {
  tries: number; // in all, the first included
  waitMs: number;
  isCancelled: () => boolean;
  wait?: (ms: number) => Promise<void>;
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export async function retrying<T>(attempt: () => Promise<T>, again: (result: T) => boolean, r: Retries): Promise<T> {
  const wait = r.wait ?? sleep;
  let result = await attempt();
  for (let n = 1; n < r.tries && again(result) && !r.isCancelled(); n++) {
    await wait(r.waitMs);
    if (r.isCancelled()) break;
    result = await attempt();
  }
  return result;
}
