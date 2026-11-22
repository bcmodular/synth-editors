// Setting the desk up from the rig file, start to finish: back up to a scene, apply the chosen areas through the
// applier, read back, and save "Studio base" (docs/x32-spec.md, "Set up from the rig file").

import { applyChanges, refuseOutside, SETUP_ALLOWED, type ApplyResult, type DeskIO } from "./applier";
import { backupName, BASE_NAME, pickSlots, saveScene, type Requester, type SceneSlot } from "./scenes";
import type { SetupPlan } from "./setupPlan";
import type { Area } from "./targets";

export interface SetupResult extends ApplyResult {
  backup: number | null; // scene slot of the backup
  base: number | null; // scene slot of "Studio base", saved only if everything read back
}

export interface SetupRun {
  areas: Area[]; // the areas ticked in the panel
  slots: SceneSlot[]; // the desk's scene slots, read with the plan
  now: Date; // names the backup scene
  onProgress?: (written: number, total: number) => void;
}

export async function runSetup(desk: DeskIO & Requester, plan: SetupPlan, run: SetupRun): Promise<SetupResult> {
  const { areas, slots, now, onProgress } = run;
  const changes = plan.changes.filter((c) => areas.includes(c.area));
  if (!changes.length) return { written: 0, total: 0, mismatches: [], backup: null, base: null };
  refuseOutside(changes, SETUP_ALLOWED); // before the backup: nothing happens if any address is refused
  const { backup, base } = pickSlots(slots);
  await saveScene(desk, backup, backupName(now), "Before setup from the rig file");
  const result = await applyChanges(desk, changes, SETUP_ALLOWED, onProgress);
  if (result.mismatches.length) return { ...result, backup, base: null };
  await saveScene(desk, base, BASE_NAME, "Set up from the rig file");
  return { ...result, backup, base };
}
