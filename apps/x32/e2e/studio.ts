// The fake desk as the real one is now: out of the box (factory.ts), set up from the rig file (rig/studio.json), with
// the TB-3 sent to the reverb and a few presets in the FX library. For the Sends panel, effects and the chat. Loaded by
// Playwright and vitest, not plain Node (the planner's imports have no extensions).

import studio from "../rig/studio.json" with { type: "json" };
import { fx, send, strip, type Param } from "../src/core/addresses";
import type { DeskValue } from "../src/core/cache";
import { desiredTargets } from "../src/core/desired";
import { typeValue } from "../src/core/effects";
import { int, str, type OscArg, type OscMessage } from "../src/core/osc";
import type { OperatorDesk } from "../src/core/operator";
import type { Preset } from "../src/core/presets";
import { parseRigFile } from "../src/core/rigFile";
import { libFx } from "../src/core/routing";
import { sharedBuses, type SharedBus } from "../src/core/shared";
import { factoryDesk } from "./factory";
import { put, type Values } from "./rig";

export const studioRig = parseRigFile(studio);
export const studioShared: SharedBus[] = sharedBuses(studioRig);

// A stand-in for the preset catalogue (the real one stays out of the repo), in the desk's library order.
export const TEST_PRESETS: Preset[] = [
  { name: "Big Concert", type: "Hall Reverb", code: "HALL", slots: "1-4", description: "A large, warm hall, about 2.2 s.", tags: ["reverb", "hall", "long", "pad"] },
  { name: "Vocal Plate", type: "Plate Reverb", code: "PLAT", slots: "1-4", description: "A bright plate, about 1.7 s.", tags: ["reverb", "plate", "vocal"] },
  { name: "Memory Man", type: "Stereo Delay", code: "DLY", slots: "1-4", description: "A warm 180 ms slapback.", tags: ["delay", "slapback", "lead"], source: "Insert" },
  { name: "Phil's Drums", type: "Gated Reverb", code: "GATE", slots: "1-4", description: "A tight gated reverb for drum-machine snares and toms.", tags: ["reverb", "gated", "80s", "drums", "snare"] },
  { name: "Squeezer", type: "Precision Limiter", code: "LIM", slots: "1-8", description: "A limiter that makes a bus louder.", tags: ["limiter", "insert", "bus"], source: "Insert" },
  { name: "Not On Desk", type: "Stereo Chorus", code: "CRS", slots: "1-4", description: "Missing from the library.", tags: ["chorus"] },
];
const LIBRARY = TEST_PRESETS.filter((p) => p.name !== "Not On Desk");

// What a library load does to a slot: its type becomes the preset's (the parameters aren't modelled).
export function loadInto(args: OscArg[], get: (a: string) => DeskValue | undefined, set: (p: Param, v: DeskValue) => void): boolean {
  const [kind, index, slot0] = args.map((a) => a.value);
  const preset = LIBRARY[Number(index)];
  if (kind !== "libfx" || !preset || typeof slot0 !== "number") return false;
  const value = typeValue({ slot: slot0 + 1 }, preset.code);
  if (value === null) return false;
  set(fx(slot0 + 1).type, value);
  return get(fx(slot0 + 1).type.address) === value;
}

export function studioDesk(): Values {
  const values = factoryDesk();
  for (const t of desiredTargets(studioRig)) put(values, t.param, t.value);
  for (const n of [7, 8]) for (const bus of [1, 2]) put(values, send(strip("ch", n), bus).level, 0.7); // TB-3 → Reverb
  for (let n = 1; n <= 100; n++) put(values, libFx(n).name, LIBRARY[n - 1]?.name ?? "");
  return values;
}

// An in-memory desk the operator can drive, library loads included.
export function memoryDesk(connected = true): OperatorDesk & { values: Map<string, DeskValue>; writes: string[] } {
  const values = new Map([...studioDesk()].map(([a, arg]) => [a, arg.value as DeskValue]));
  const writes: string[] = [];
  const set = (p: Param, v: DeskValue) => {
    writes.push(p.address);
    values.set(p.address, v);
  };
  return {
    values, writes, connected: () => connected, write: set,
    read: async (p: Param) => values.get(p.address)!,
    request: async (address: string, args: OscArg[]): Promise<OscMessage> => {
      writes.push(`${address} ${args.map((a) => a.value).join(" ")}`);
      const ok = address === "/load" && loadInto(args, (a) => values.get(a), (p, v) => values.set(p.address, v));
      return { address, args: [str(String(args[0]?.value ?? "")), int(ok ? 1 : 0)] };
    },
  };
}
