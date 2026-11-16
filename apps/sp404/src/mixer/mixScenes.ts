// Mix scenes on the desk (docs/sp404-design.md › Pad mixer › Mix scenes): 16 per SP-404 project, each the mixer values
// and MUTE buttons of the pads loaded when it was stored, recalled by the rule in core/mixer.ts (pads in the scene
// that are loaded take its values, others are left alone, gone pads are skipped), with RECALL SAFE per value type.
// Pure; useMixScenes keeps them per project and the mixer sends what changes.

import {
  MIX_SCENE_COUNT, recallMixScene, storeMixScene, type MixScene, type MixerPad, type SafeType,
} from "../core/mixer";
import type { PadBlock } from "../core/serialMessages";
import { editPad, setButtons, setFields, viewPad, type ButtonsEdit, type DeskPad, type MixMemory } from "./mixerState";

export const SAFE_TYPES: readonly SafeType[] = ["level", "pan", "routing", "mute", "muteGroup", "ahr"];
export const SAFE_LABELS: Record<SafeType, string> = {
  level: "LEVEL", pan: "PAN", routing: "ROUTING", mute: "MUTE", muteGroup: "MUTE GRP", ahr: "AHR",
};

export interface MixScenes {
  scenes: (MixScene | null)[];
  safe: SafeType[];
}

export const emptyMixScenes = (): MixScenes => ({ scenes: Array<MixScene | null>(MIX_SCENE_COUNT).fill(null), safe: [] });

// A scene stores each pad's values (the level it goes back to while silent) and its MUTE button; SOLO isn't kept.
const asStored = (pads: readonly DeskPad[]): MixerPad[] => pads.map((p) => ({ ...p, muted: p.mute }));

export const storeScene = (pads: readonly DeskPad[]): MixScene => storeMixScene(asStored(pads));

export function storeAt(s: MixScenes, slot: number, pads: readonly DeskPad[]): MixScenes {
  return { ...s, scenes: s.scenes.map((v, i) => (i === slot ? storeScene(pads) : v)) };
}

export const deleteAt = (s: MixScenes, slot: number): MixScenes =>
  ({ ...s, scenes: s.scenes.map((v, i) => (i === slot ? null : v)) });

export function toggleSafe(s: MixScenes, type: SafeType): MixScenes {
  return { ...s, safe: s.safe.includes(type) ? s.safe.filter((t) => t !== type) : [...s.safe, type] };
}

const MIX_KEYS = ["level", "pan", "routing", "muteGroup", "attack", "hold", "release"] as const;
const sameMix = (a: MixerPad["mix"], b: MixerPad["mix"]) => MIX_KEYS.every((k) => a[k] === b[k]);

// The stored scene the desk matches now (every loaded pad in it has its values and MUTE button), if any.
export function currentScene(s: MixScenes, pads: readonly DeskPad[]): number | undefined {
  const matches = (scene: MixScene) => pads.every((p) => {
    const stored = scene[p.pad];
    return !stored || (sameMix(stored.mix, p.mix) && stored.muted === p.mute);
  });
  const i = s.scenes.findIndex((scene) => scene !== null && Object.keys(scene).length > 0 && matches(scene));
  return i >= 0 ? i : undefined;
}

// The MUTE buttons after a recall: the scene's for its loaded pads, unless MUTE is safe.
function mutesAfter(memory: MixMemory, pads: readonly DeskPad[], scene: MixScene, safe: ReadonlySet<SafeType>) {
  if (safe.has("mute")) return memory.mutes;
  const inScene = new Set(pads.filter((p) => scene[p.pad]).map((p) => p.pad));
  const kept = memory.mutes.filter((n) => !inScene.has(n));
  return [...kept, ...[...inScene].filter((n) => scene[n]!.muted)];
}

// Recall a scene onto the device's pads: the values first (each pad an edit, as a fader move is), then the MUTE
// buttons. What to send comes back with the new blocks and memory.
export function recallScene(blocks: readonly PadBlock[], memory: MixMemory, scene: MixScene,
  safe: ReadonlySet<SafeType>): ButtonsEdit {
  const pads = blocks.map((b) => viewPad(b, memory));
  const target = recallMixScene(pads, scene, new Set([...safe, "mute"])).pads;
  let mem = memory;
  const values: ButtonsEdit = { blocks: [], memory, changes: [] };
  blocks.forEach((block, i) => {
    const e = editPad(block, mem, setFields(target[i]!.mix));
    mem = e.memory;
    values.blocks.push(e.block);
    values.changes.push(...e.changes);
  });
  const buttons = setButtons(values.blocks, mem, { mutes: mutesAfter(mem, pads, scene, safe), solos: mem.solos });
  return { blocks: buttons.blocks, memory: buttons.memory, changes: [...values.changes, ...buttons.changes] };
}

// Stored scenes read back; anything malformed is dropped.
export function readMixScenes(saved: unknown): MixScenes {
  const s = saved as Partial<MixScenes> | null;
  const empty = emptyMixScenes();
  if (!s || !Array.isArray(s.scenes)) return empty;
  return {
    scenes: empty.scenes.map((_, i) => (typeof s.scenes![i] === "object" ? s.scenes![i] ?? null : null)),
    safe: Array.isArray(s.safe) ? s.safe.filter((t) => SAFE_TYPES.includes(t)) : [],
  };
}
