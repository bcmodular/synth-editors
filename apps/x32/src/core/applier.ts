// The only module that writes to the desk. It refuses any address outside the allowed list, writes in apply order, a
// few at a time, and reads every written value back. It stops at the first batch that doesn't read back as written.

import type { Param } from "./addresses";
import type { DeskValue } from "./cache";
import { applyOrder, sameValue, type Change } from "./setupPlan";

// Setup from the rig file may write these, and nothing else: never phantom power, preamp gain, sends, channel or main
// faders, the main and monitor sections, network or MIDI settings, scene safes or FX types (docs/x32-spec.md, loop
// guards). Bus masters are allowed: a bus at -inf feeds nothing to its FX slot or output (found 22 Nov).
export const SETUP_ALLOWED: RegExp[] = [
  /^\/config\/routing\/(IN|CARD)\/\d+-\d+$/,
  /^\/config\/userrout\/(in|out)\/\d\d$/,
  /^\/config\/(ch|aux|fx|bus)link\/\d+-\d+$/,
  /^\/(ch|auxin|fxrtn|bus)\/\d\d\/config\/(name|color|icon)$/,
  /^\/(ch|auxin|fxrtn)\/\d\d\/mix\/(01|03|05|07|09|11|13|15)\/type$/,
  /^\/auxin\/\d\d\/mix\/on$/,
  /^\/outputs\/(main|aux|p16)\/\d\d\/(src|pos)$/,
  /^\/fx\/[1-4]\/source\/[lr]$/,
  /^\/bus\/\d\d\/mix\/fader$/,
];

export class NotAllowed extends Error {
  constructor(addresses: string[]) {
    super(`Refused: ${addresses.slice(0, 5).join(", ")}${addresses.length > 5 ? ` and ${addresses.length - 5} more` : ""} isn't on the allowed list`);
    this.name = "NotAllowed";
  }
}

export function refuseOutside(changes: Change[], allowed: RegExp[]): void {
  const refused = changes.map((c) => c.param.address).filter((a) => !allowed.some((r) => r.test(a)));
  if (refused.length) throw new NotAllowed(refused);
}

export interface DeskIO {
  read(param: Param): Promise<DeskValue>;
  write(param: Param, value: DeskValue): void;
}

export interface Mismatch {
  change: Change;
  got: DeskValue | undefined; // undefined: no answer
}

export interface ApplyResult {
  written: number;
  total: number;
  mismatches: Mismatch[];
}

export const WRITE_BATCH = 16;

// The real desk can answer a read with the old value for a moment after a write (seen on user routing, 22 Nov), so
// read-back waits a little first, and asks again about anything that doesn't match before calling it a mismatch.
export const SETTLE_MS = 100;
export const READ_TRIES = 5;
const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function readOnce(desk: DeskIO, changes: Change[]): Promise<Mismatch[]> {
  const got = await Promise.all(changes.map((c) => desk.read(c.param).catch(() => undefined)));
  return changes.flatMap((change, i) => (sameValue(got[i], change.value) ? [] : [{ change, got: got[i] }]));
}

async function readBack(desk: DeskIO, batch: Change[]): Promise<Mismatch[]> {
  let mismatches = batch.map((change) => ({ change, got: undefined as DeskValue | undefined }));
  for (let tries = 0; tries < READ_TRIES && mismatches.length; tries++) {
    await pause(SETTLE_MS);
    mismatches = await readOnce(desk, mismatches.map((m) => m.change));
  }
  return mismatches;
}

export async function applyChanges(
  desk: DeskIO,
  changes: Change[],
  allowed: RegExp[],
  onProgress: (written: number, total: number) => void = () => {},
): Promise<ApplyResult> {
  refuseOutside(changes, allowed);
  const ordered = applyOrder(changes);
  let written = 0;
  for (let at = 0; at < ordered.length; at += WRITE_BATCH) {
    const batch = ordered.slice(at, at + WRITE_BATCH);
    for (const c of batch) desk.write(c.param, c.value);
    written += batch.length;
    onProgress(written, ordered.length);
    const mismatches = await readBack(desk, batch);
    if (mismatches.length) return { written, total: ordered.length, mismatches };
  }
  return { written, total: ordered.length, mismatches: [] };
}
