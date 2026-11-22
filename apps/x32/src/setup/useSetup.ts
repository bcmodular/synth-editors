// The Setup panel's state: check the desk against the rig file (reads only), then apply the chosen areas.

import { useCallback, useMemo, useState } from "react";
import studio from "../../rig/studio.json";
import { desiredTargets } from "../core/desired";
import { readAll } from "../core/reader";
import { parseRigFile } from "../core/rigFile";
import { sceneParams, sceneSlots, type SceneSlot } from "../core/scenes";
import { runSetup, type SetupResult } from "../core/setup";
import { manualSteps, planSetup, type SetupPlan } from "../core/setupPlan";
import type { Area, Target } from "../core/targets";
import type { Desk } from "../desk/useDesk";

export type SetupState =
  | { kind: "idle" }
  | { kind: "checking"; done: number; total: number }
  | { kind: "planned"; plan: SetupPlan; slots: SceneSlot[] }
  | { kind: "applying"; written: number; total: number }
  | { kind: "done"; result: SetupResult; plan: SetupPlan }
  | { kind: "error"; message: string };

export interface Setup {
  state: SetupState;
  check: () => Promise<void>;
  apply: (areas: Area[]) => Promise<void>;
}

function loadTargets(): { targets: Target[]; manual: string[] } | { error: string } {
  try {
    const rig = parseRigFile(studio);
    return { targets: desiredTargets(rig), manual: manualSteps(rig) };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

export function useSetup(desk: Desk): Setup {
  const loaded = useMemo(loadTargets, []);
  const [state, setState] = useState<SetupState>(() => ("error" in loaded ? { kind: "error", message: loaded.error } : { kind: "idle" }));
  const get = useCallback((a: string) => desk.cache.get(a), [desk.cache]);

  const check = useCallback(async () => {
    if ("error" in loaded || !desk.client) return;
    const params = [...loaded.targets.map((t) => t.param), ...sceneParams()];
    setState({ kind: "checking", done: 0, total: params.length });
    await readAll(desk.client, params, (p) => setState({ kind: "checking", done: p.done, total: p.total }));
    setState({ kind: "planned", plan: planSetup(loaded.targets, get, loaded.manual), slots: sceneSlots(get) });
  }, [loaded, desk.client, get]);

  const apply = useCallback(async (areas: Area[]) => {
    if (state.kind !== "planned" || !desk.client) return;
    const { plan, slots } = state;
    setState({ kind: "applying", written: 0, total: plan.changes.length });
    try {
      const onProgress = (written: number, total: number) => setState({ kind: "applying", written, total });
      const result = await runSetup(desk.client, plan, { areas, slots, now: new Date(), onProgress });
      setState({ kind: "done", result, plan });
    } catch (e) {
      setState({ kind: "error", message: message(e) });
    }
  }, [state, desk.client]);

  return { state, check, apply };
}
