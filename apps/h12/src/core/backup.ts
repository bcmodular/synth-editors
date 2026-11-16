// The H12's own values of the settings target switching writes, kept before the app first writes to it, so they can
// be put back (mappers 18–23 may have held manual settings). Restoring goes through applySettings like a switch.

import { settingKey, SWITCH_SETTINGS, type SettingValue } from "./targets";

export interface Backup {
  savedAt: string; // ISO date
  settings: SettingValue[];
}

export function backupOf(current: ReadonlyMap<string, number[]>, now: Date): Backup {
  const settings = SWITCH_SETTINGS.map((s) => ({ label: s.label, setting: s.setting, index: s.index,
    words: current.get(settingKey(s)) ?? [] }));
  return { savedAt: now.toISOString(), settings };
}

const isWord = (w: unknown) => typeof w === "number" && Number.isInteger(w) && w >= 0 && w <= 0xffffffff;

const isShaped = (b: Partial<Backup> | null): b is Backup =>
  typeof b?.savedAt === "string" && Array.isArray(b.settings) && b.settings.length === SWITCH_SETTINGS.length;

const hasWords = (v: SettingValue, count: number) => Array.isArray(v.words) && v.words.length === count && v.words.every(isWord);

// The i-th entry must be the i-th switch setting, with the right number of words.
const entryOk = (v: SettingValue | undefined, i: number) => {
  const s = SWITCH_SETTINGS[i]!;
  const same = v?.setting === s.setting && v.index === s.index;
  return same && hasWords(v, s.words);
};

// A backup read back from storage, or undefined if it isn't one: every setting in SWITCH_SETTINGS, and no other.
export function parseBackup(json: unknown): Backup | undefined {
  const b = json as Partial<Backup> | null;
  if (!isShaped(b)) return undefined;
  return b.settings.every(entryOk) ? { savedAt: b.savedAt, settings: b.settings } : undefined;
}
