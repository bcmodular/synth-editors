// The rig file check for the chat (check_rig): read what the rig file covers, then say what differs. Applying stays
// in the Setup panel, after its backup scene.

import { readAll } from "../core/reader";
import { driftText, planSetup } from "../core/setupPlan";
import type { Desk } from "../desk/useDesk";
import { loadTargets } from "./useSetup";

export async function checkRigNow(desk: Desk): Promise<{ text: string; kind: string }> {
  const loaded = loadTargets();
  if ("error" in loaded) return { text: loaded.error, kind: "error" };
  if (!desk.client || desk.link !== "connected") return { text: "The desk isn't connected.", kind: "offline" };
  await readAll(desk.client, loaded.targets.map((t) => t.param));
  return { text: driftText(planSetup(loaded.targets, (a) => desk.cache.get(a))), kind: "state" };
}
