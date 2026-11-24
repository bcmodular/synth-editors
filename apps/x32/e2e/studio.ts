// The fake desk as the real one is now: out of the box (factory.ts), set up from the rig file (rig/studio.json), with
// the TB-3 sent to the reverb and the factory presets in the FX library. For the Sends panel, effects and the chat. Loaded by
// Playwright and vitest, not plain Node (the planner's imports have no extensions).

import fxPresets from "../rig/fx-presets.json" with { type: "json" };
import studio from "../rig/studio.json" with { type: "json" };
import { fx, send, strip, type Param } from "../src/core/addresses";
import type { DeskValue } from "../src/core/cache";
import { desiredTargets } from "../src/core/desired";
import { typeValue } from "../src/core/effects";
import { int, str, type OscArg, type OscMessage } from "../src/core/osc";
import type { OperatorDesk } from "../src/core/operator";
import { parsePresets, type Preset } from "../src/core/presets";
import { parseRigFile } from "../src/core/rigFile";
import { libFx } from "../src/core/routing";
import { sharedBuses, type SharedBus } from "../src/core/shared";
import { factoryDesk } from "./factory";
import { put, type Values } from "./rig";

export const studioRig = parseRigFile(studio);
export const studioShared: SharedBus[] = sharedBuses(studioRig);

// The catalogue (rig/fx-presets.json), and the desk's FX library in the order the real one keeps it (read 22 Nov).
export const STUDIO_PRESETS: Preset[] = parsePresets(fxPresets);
export const DESK_LIBRARY = [
  "Big Concert", "Vocal Plate", "Cathedral", "Echo Hangar", "Drum Treat", "Sound Stage", "Phil's Drums", "Backwards",
  "Memory Man", "Third Groove", "Canyon", "Danish Chor", "Dimension Z", "Choriance", "Thing!", "Floom",
  "Green Phaser", "ADA-Flanger", "B3 Leslie", "LFO Wah", "Dyno Trem", "Chordia", "Crunch", "The Voice", "Punchito",
  "Final Mix", "Squeezer", "Punch", "A Step Back", "Stereorizer", "BBM #1 E7", "BBM 80s Nvr End", "BBM Ballad Snare",
  "BBM Cutting D6", "BBM Dly Chr VOX", "BBM Fat Snare", "BBM Female Vox", "BBM FLANGY AMB", "BBM H949 Vox",
  "BBM Hwy Star B3", "BBM JJ Bass", "BBM Magnum Opus", "BBM Miami Mod B3", "BBM Ska GTR Echo", "BBM Solina Swirl",
  "BBM Thk Cln GTR", "BBM Tight Plate", "BBM Tramp Whirly", "BBM VOX Hall", "BBM Wide VOX Tap", "TJ Fat Horns",
  "TJ Horn Verb&Dly", "TJ Ping Pong", "TJ Vox Plate",
];
const LIBRARY: Preset[] = DESK_LIBRARY.map((name) => STUDIO_PRESETS.find((p) => p.name === name)!);

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

// A scene or snippet /save (names the slot) or /load (works if the slot holds something); null for anything else.
function showCommand(values: Map<string, DeskValue>, address: string, args: OscArg[]): boolean | null {
  const [kind, n, name] = args.map((a) => a.value);
  if (kind !== "scene" && kind !== "snippet") return null;
  const slot = `/-show/showfile/${kind}/${String(n).padStart(3, "0")}`;
  if (address === "/load") return values.get(`${slot}/hasdata`) === 1;
  values.set(`${slot}/name`, String(name));
  values.set(`${slot}/hasdata`, 1);
  return true;
}

// An in-memory desk the operator can drive, library loads, saves and scene loads included.
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
      const ok = showCommand(values, address, args) ?? (address === "/load" && loadInto(args, (a) => values.get(a), (p, v) => values.set(p.address, v)));
      return { address, args: [str(String(args[0]?.value ?? "")), int(ok ? 1 : 0)] };
    },
  };
}
