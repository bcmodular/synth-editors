// Persistence: the whole session, unsaved edits included, survives quitting. Also the morph rate.
import { patchFromHex, patchToHex } from "../core/patchSet";
import { freshSession } from "./sessionState";
import type { SessionState } from "./sessionState";

const STORAGE_KEY = "tb3.session";
const RATE_KEY = "tb3.morphRate";

// Morph sends are capped in changed bytes per second; see morphPump.ts.
export const MORPH_RATES = [10, 20, 30, 50, 75, 100, 150, 200, 300, 500] as const;
const DEFAULT_RATE = 100;

export interface StoredSession {
  setPath: string | null;
  slots: ({ name: string; hex: string } | null)[];
  savedKeys: string[];
  active: number | null;
  buffer: string | null;
  bufferName?: string | null;
}

export const toStored = (s: SessionState): StoredSession => ({
  setPath: s.setPath,
  slots: s.slots.map((x) => x && { name: x.name, hex: patchToHex(x.patch) }),
  savedKeys: [...s.savedKeys],
  active: s.active,
  buffer: s.buffer ? patchToHex(s.buffer) : null,
  bufferName: s.bufferName,
});

export const fromStored = (s: StoredSession): SessionState => ({
  ...freshSession(),
  setPath: s.setPath,
  slots: s.slots.map((x) => x && { name: x.name, patch: patchFromHex(x.hex) }),
  savedKeys: s.savedKeys,
  active: s.active,
  buffer: s.buffer ? patchFromHex(s.buffer) : null,
  bufferName: s.bufferName ?? null,
});

export function restoreSession(): SessionState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? fromStored(JSON.parse(raw) as StoredSession) : freshSession();
  } catch {
    return freshSession(); // unreadable recovery data: start clean rather than fail to open
  }
}

export function persistSession(s: SessionState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toStored(s)));
  } catch {
    // Recovery is best effort.
  }
}

export function restoreRate(): number {
  const v = Number(localStorage.getItem(RATE_KEY));
  return (MORPH_RATES as readonly number[]).includes(v) ? v : DEFAULT_RATE;
}

export function persistRate(r: number) {
  try {
    localStorage.setItem(RATE_KEY, String(r));
  } catch {
    // best effort
  }
}
