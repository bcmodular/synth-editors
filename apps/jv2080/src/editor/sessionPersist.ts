// Persistence: the whole session (the open set, unsaved edits included, and the patch in the editor) survives
// quitting. After apps/tb3/src/editor/sessionPersist.ts.
import { patchFromHex, patchToHex, SLOT_COUNT } from "../core/patchSet";
import { freshSession } from "./sessionState";
import type { SessionState } from "./sessionState";

const STORAGE_KEY = "jv2080.session";

export interface StoredSession {
  setPath: string | null;
  slots: ({ name: string; hex: string } | null)[];
  savedKeys: string[];
  active: number | null;
  buffer: string | null;
  bufferName: string | null;
}

export const toStored = (s: SessionState): StoredSession => ({
  setPath: s.setPath,
  slots: s.slots.map((x) => x && { name: x.name, hex: patchToHex(x.patch) }),
  savedKeys: [...s.savedKeys],
  active: s.active,
  buffer: s.buffer ? patchToHex(s.buffer) : null,
  bufferName: s.bufferName,
});

export function fromStored(s: StoredSession): SessionState {
  if (s.slots.length !== SLOT_COUNT || s.savedKeys.length !== SLOT_COUNT) throw new Error("not a JV session");
  return {
    ...freshSession(),
    setPath: s.setPath,
    slots: s.slots.map((x) => x && { name: x.name, patch: patchFromHex(x.hex) }),
    savedKeys: s.savedKeys,
    active: s.active,
    buffer: s.buffer ? patchFromHex(s.buffer) : null,
    bufferName: s.bufferName ?? null,
  };
}

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
