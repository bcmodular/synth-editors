// The mix scenes for the SP-404's current project (mixScenes.ts), kept in localStorage per project as the MUTE memory
// is: an empty slot stores, a stored one recalls, and in DEL mode a stored one is deleted.

import { useCallback, useEffect, useState } from "react";
import type { SafeType } from "../core/mixer";
import type { FxMode } from "../fx/useFxPlay";
import { currentScene, deleteAt, emptyMixScenes, readMixScenes, storeAt, toggleSafe, type MixScenes } from "./mixScenes";
import type { Mixer } from "./useMixer";

const keyOf = (project: number) => `sp404.mixScenes.${project}`;

function load(project: number | undefined): MixScenes {
  if (project === undefined) return emptyMixScenes();
  try {
    return readMixScenes(JSON.parse(localStorage.getItem(keyOf(project)) ?? "null"));
  } catch {
    return emptyMixScenes();
  }
}

export function useMixScenes(project: number | undefined, mixer: Mixer, mode: FxMode) {
  const [scenes, setScenes] = useState(() => load(project));
  useEffect(() => setScenes(load(project)), [project]);
  const save = useCallback((next: MixScenes) => {
    setScenes(next);
    if (project !== undefined) localStorage.setItem(keyOf(project), JSON.stringify(next));
  }, [project]);

  const press = useCallback((slot: number) => {
    const scene = scenes.scenes[slot];
    if (mode === "delete") return scene && save(deleteAt(scenes, slot));
    if (scene) mixer.recall(scene, new Set(scenes.safe));
    else if (mixer.pads.length > 0) save(storeAt(scenes, slot, mixer.pads));
  }, [mixer, mode, save, scenes]);

  const toggle = useCallback((type: SafeType) => save(toggleSafe(scenes, type)), [save, scenes]);

  return {
    stored: scenes.scenes.map((s) => s !== null), safe: new Set(scenes.safe), current: currentScene(scenes, mixer.pads),
    ready: project !== undefined, press, toggleSafe: toggle,
  };
}

export type MixSceneControls = ReturnType<typeof useMixScenes>;
