// The shared buses (the Sampler and its targets) from the rig file. A rig file that doesn't parse leaves none; the
// Setup panel shows why.

import studio from "../../rig/studio.json";
import { parseRigFile } from "../core/rigFile";
import { sharedBuses, type SharedBus } from "../core/shared";

function load(): SharedBus[] {
  try {
    return sharedBuses(parseRigFile(studio));
  } catch {
    return [];
  }
}

export const studioShared: SharedBus[] = load();
