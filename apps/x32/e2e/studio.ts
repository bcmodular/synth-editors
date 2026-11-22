// The fake desk as the real one is now: out of the box (factory.ts), set up from the rig file (rig/studio.json), with
// the TB-3 sent to the reverb. For the Sends panel and the chat. Loaded by Playwright and vitest, not plain Node (the
// planner's imports have no extensions).

import studio from "../rig/studio.json" with { type: "json" };
import { send, strip } from "../src/core/addresses";
import { desiredTargets } from "../src/core/desired";
import { parseRigFile } from "../src/core/rigFile";
import { sharedBuses, type SharedBus } from "../src/core/shared";
import { factoryDesk } from "./factory";
import { put, type Values } from "./rig";

export const studioRig = parseRigFile(studio);
export const studioShared: SharedBus[] = sharedBuses(studioRig);

export function studioDesk(): Values {
  const values = factoryDesk();
  for (const t of desiredTargets(studioRig)) put(values, t.param, t.value);
  for (const n of [7, 8]) for (const bus of [1, 2]) put(values, send(strip("ch", n), bus).level, 0.7); // TB-3 → Reverb
  return values;
}
