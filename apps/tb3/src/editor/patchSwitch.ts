// The messages that switch the TB-3 from one patch to another (recall, audition, undo). A switch while a pattern
// plays can pop or screech: the messages take tens of ms, and in between the TB-3 plays a mixture of the two
// patches. Only changed bytes are sent, to keep that short. A quiet switch also takes MASTER VOLUME to 0 first and
// back up last, so the mixture is never heard, only a short gap.
import { encodeParam, getRaw, runToSysex, setRaw, switchRuns } from "../core/patch";
import type { Patch } from "../core/patch";
import { paramById } from "../core/params";

const VOLUME = paramById("master_volume");

const messages = (from: Patch, to: Patch) => switchRuns(from, to).map(runToSysex);

export function switchMessages(from: Patch, to: Patch, quiet: boolean): number[][] {
  if (!quiet) return messages(from, to);
  const middle = messages(setRaw(from, VOLUME, 0), setRaw(to, VOLUME, 0));
  if (!middle.length) return messages(from, to); // nothing but the volume changes
  return [encodeParam(VOLUME, 0), ...middle, encodeParam(VOLUME, getRaw(to, VOLUME))];
}
