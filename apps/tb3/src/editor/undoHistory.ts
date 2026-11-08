// Undo history: snapshots of the session taken just before each undoable action. See
// docs/tb3-phase3-design.md (Undo history).
import type { Patch } from "../core/patch";
import type { Slots } from "../core/patchSet";
import type { MorphState, SessionState } from "./sessionState";

export const HISTORY_DEPTH = 100;
export const MERGE_MS = 1000; // consecutive edits to one param within this merge into one step

// What a step restores. The set's path and saved state are left out, so undoing after a save
// still marks the slot modified.
export interface Snapshot {
  slots: Slots;
  active: number | null;
  buffer: Patch | null;
  bufferName: string | null;
  morph: MorphState;
}

export interface Step {
  label: string; // e.g. "DELETE slot 3"
  before: Snapshot;
  merge?: { key: string; at: number }; // param edits: which param, and when last edited
}

export interface History {
  past: readonly Step[];
  future: readonly Step[];
}

export const emptyHistory: History = { past: [], future: [] };

export const takeSnapshot = (s: SessionState, morph: MorphState): Snapshot => ({
  slots: s.slots,
  active: s.active,
  buffer: s.buffer,
  bufferName: s.bufferName,
  morph,
});

export function restoreSnapshot(s: SessionState, snap: Snapshot): { session: SessionState; morph: MorphState } {
  const { morph, ...rest } = snap;
  return { session: { ...s, ...rest }, morph };
}

// A further edit to the same param soon after the last step joins that step.
function joinsLast(last: Step | undefined, merge: Step["merge"]): boolean {
  if (!last?.merge || !merge) return false;
  return last.merge.key === merge.key && merge.at - last.merge.at <= MERGE_MS;
}

// Record a step about to happen. Clears redo.
export function record(h: History, step: Step): History {
  const last = h.past.at(-1);
  if (joinsLast(last, step.merge)) {
    return { past: [...h.past.slice(0, -1), { ...last!, merge: step.merge }], future: [] };
  }
  return { past: [...h.past, step].slice(-HISTORY_DEPTH), future: [] };
}

// After an undo or redo no later edit joins an earlier step.
const sealed = (steps: readonly Step[]): Step[] =>
  steps.map((st, i) => (i === steps.length - 1 ? { label: st.label, before: st.before } : st));

// Move the newest step of `from` onto `to`, holding `now` in its place: undo moves past to future,
// redo moves it back. Returns the snapshot to restore.
function shift(from: readonly Step[], to: readonly Step[], now: Snapshot) {
  const step = from.at(-1);
  if (!step) return null;
  return {
    from: sealed(from.slice(0, -1)),
    to: [...to, { label: step.label, before: now }],
    restore: step.before,
  };
}

// Undo: the snapshot to restore, with the current state kept for redo. Null with nothing to undo.
export function undo(h: History, now: Snapshot): { history: History; restore: Snapshot } | null {
  const r = shift(h.past, h.future, now);
  return r && { history: { past: r.from, future: r.to }, restore: r.restore };
}

export function redo(h: History, now: Snapshot): { history: History; restore: Snapshot } | null {
  const r = shift(h.future, h.past, now);
  return r && { history: { past: r.to, future: r.from }, restore: r.restore };
}

export const undoLabel = (h: History): string | null => h.past.at(-1)?.label ?? null;
export const redoLabel = (h: History): string | null => h.future.at(-1)?.label ?? null;
