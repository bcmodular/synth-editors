// What the plans need from the rig file: the shared buses (the Sampler and its targets), and which bus feeds each FX
// slot (put back when an insert is taken off). A rig file that doesn't parse leaves none; the Setup panel shows why.

import studio from "../../rig/studio.json";
import { parseRigFile, type RigFile } from "../core/rigFile";
import { sharedBuses, type SharedBus } from "../core/shared";

function load(): RigFile | null {
  try {
    return parseRigFile(studio);
  } catch {
    return null;
  }
}

const rig = load();
export const studioShared: SharedBus[] = rig ? sharedBuses(rig) : [];
export const studioFeeds = rig?.fx ?? [];
