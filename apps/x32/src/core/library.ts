// Loading a preset from the desk's FX library into a slot (Maillot, "/load", printed page 51): `/load ,sii libfx
// <index> <slot 0-7>`, answered `/load ,si libfx 1`. The answer can come before the load is done, so the slot's type is
// read back until it's the preset's (that also catches a wrong index).

import { fx, type Param } from "./addresses";
import type { DeskIO, Mismatch } from "./applier";
import { typeCode, typeValue } from "./effects";
import { int, str } from "./osc";
import { LOAD, FX_LIBRARY_SIZE, libFx } from "./routing";
import type { Requester } from "./scenes";

export interface PresetLoad {
  name: string;
  index: number; // in the library, from 0 (/-libs/fx/001 is 0)
  slot: number; // 1-8
  code: string; // the type it loads as ("HALL")
}

export const LOAD_SETTLE_MS = 150;
export const LOAD_TRIES = 10;
const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// The library's names, by index, from the cache ("" for an empty place).
export const libraryNames = (get: (a: string) => unknown): string[] =>
  Array.from({ length: FX_LIBRARY_SIZE }, (_, i) => String(get(libFx(i + 1).name.address) ?? ""));

export const libraryParams = (): Param[] => Array.from({ length: FX_LIBRARY_SIZE }, (_, i) => libFx(i + 1).name);

function failed(load: PresetLoad, got: number | undefined): Mismatch {
  const param = fx(load.slot).type;
  const want = typeValue(load, load.code) ?? -1;
  return { change: { param, value: want, what: `FX ${load.slot} loaded with "${load.name}" (${load.code})` }, got };
}

// Null when the slot holds the preset's type; the mismatch otherwise.
export async function loadPreset(desk: DeskIO & Requester, load: PresetLoad): Promise<Mismatch | null> {
  const reply = await desk.request(LOAD, [str("libfx"), int(load.index), int(load.slot - 1)], (m) => m.address === LOAD);
  if (reply.args[1]?.value !== 1) return failed(load, undefined);
  let got: number | undefined;
  for (let tries = 0; tries < LOAD_TRIES; tries++) {
    await pause(LOAD_SETTLE_MS);
    got = Number(await desk.read(fx(load.slot).type).catch(() => undefined));
    if (typeCode({ slot: load.slot, value: got }) === load.code) return null;
  }
  return failed(load, got);
}
