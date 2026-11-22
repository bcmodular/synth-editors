// Scenes around a setup apply: a dated backup before the first write, and "Studio base" after the last, so either can
// be loaded on the desk without the app. Slots 1-99 (scene 0 is the desk's own).

import { SAVE, scene, SCENE_SLOTS } from "./routing";
import type { DeskValue } from "./cache";
import { int, str, type OscArg, type OscMessage } from "./osc";

export const BASE_NAME = "Studio base";

export interface SceneSlot {
  n: number;
  name: string;
  used: boolean;
}

export const sceneParams = () => Array.from({ length: SCENE_SLOTS }, (_, n) => [scene(n).name, scene(n).hasdata]).flat();

export function sceneSlots(get: (address: string) => DeskValue | undefined): SceneSlot[] {
  return Array.from({ length: SCENE_SLOTS - 1 }, (_, i) => {
    const s = scene(i + 1);
    return { n: i + 1, name: String(get(s.name.address) ?? ""), used: get(s.hasdata.address) === 1 };
  });
}

export const backupName = (now: Date) => `Backup ${now.toISOString().slice(0, 10)}`;

// The backup goes in the first empty slot; "Studio base" overwrites its own slot, or takes the next empty one.
export function pickSlots(slots: SceneSlot[]): { backup: number; base: number } {
  const free = slots.filter((s) => !s.used).map((s) => s.n);
  const existing = slots.find((s) => s.used && s.name.trim().toLowerCase() === BASE_NAME.toLowerCase())?.n;
  const backup = free[0];
  const base = existing ?? free[1];
  if (backup === undefined || base === undefined) throw new Error("No free scene slots for the backup and Studio base");
  return { backup, base };
}

export interface Requester {
  request(address: string, args: OscArg[], match?: (m: OscMessage) => boolean): Promise<OscMessage>;
}

// `/save ,siss scene <n> <name> <note>`; the desk answers `/save ,si scene 1` when it's done.
export async function saveScene(desk: Requester, n: number, name: string, note: string): Promise<void> {
  const reply = await desk.request(SAVE, [str("scene"), int(n), str(name), str(note)]);
  if (reply.args[1]?.value !== 1) throw new Error(`The desk didn't save scene ${n} ("${name}")`);
}
