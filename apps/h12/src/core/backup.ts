// The H12's own values of the settings the app writes, kept before the app first writes them, so they can be put
// back (mappers 18–23 may have held manual settings). One backup per list (targets, sync modes). Restoring goes
// through applySettings like any change.

import { settingKey, SWITCH_SETTINGS, type SettingValue } from "./targets";

type Listed = { label: string; setting: number; index: number; words: number };

export interface Backup {
  savedAt: string; // ISO date
  settings: SettingValue[];
}

export function backupOf(current: ReadonlyMap<string, number[]>, now: Date,
  list: readonly Listed[] = SWITCH_SETTINGS): Backup {
  const settings = list.map((s) => ({ label: s.label, setting: s.setting, index: s.index,
    words: current.get(settingKey(s)) ?? [] }));
  return { savedAt: now.toISOString(), settings };
}

const isWord = (w: unknown) => typeof w === "number" && Number.isInteger(w) && w >= 0 && w <= 0xffffffff;

const isShaped = (b: Partial<Backup> | null, list: readonly Listed[]): b is Backup =>
  typeof b?.savedAt === "string" && Array.isArray(b.settings) && b.settings.length === list.length;

const hasWords = (v: SettingValue, count: number) => Array.isArray(v.words) && v.words.length === count && v.words.every(isWord);

// The i-th entry must be the i-th setting of the list, with the right number of words.
const entryOk = (v: SettingValue | undefined, s: Listed) => v?.setting === s.setting && v.index === s.index
  && hasWords(v, s.words);

// A backup read back from storage, or undefined if it isn't one: every setting in the list, and no other.
export function parseBackup(json: unknown, list: readonly Listed[] = SWITCH_SETTINGS): Backup | undefined {
  const b = json as Partial<Backup> | null;
  if (!isShaped(b, list)) return undefined;
  return b.settings.every((v, i) => entryOk(v, list[i]!)) ? { savedAt: b.savedAt, settings: b.settings } : undefined;
}
