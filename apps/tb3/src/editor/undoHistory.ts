// Undo history. Session steps are snapshots of the session taken just before the action; library
// file steps (rename, move, new folder) carry their own undo and redo. See
// docs/tb3-phase3-design.md (Undo history).
import type { Patch } from "../core/patch";
import type { Slots } from "../core/patchSet";
import type { MorphState, SessionState } from "./sessionState";

export const HISTORY_DEPTH = 100;
export const MERGE_MS = 1000; // consecutive edits to one param within this merge into one step

// What a session step restores. The set's path and saved state are left out, so undoing after a
// save still marks the slot modified.
export interface Snapshot {
  slots: Slots;
  active: number | null;
  buffer: Patch | null;
  bufferName: string | null;
  morph: MorphState;
}

// A library file operation that knows how to reverse itself. Either can fail (Finder may have
// changed things since): the step is then dropped.
export interface FileAction {
  undo(): Promise<void>;
  redo(): Promise<void>;
}

export type Change = { kind: "session"; before: Snapshot } | { kind: "file"; action: FileAction };

export interface Step {
  label: string; // e.g. "DELETE slot 3"
  change: Change;
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

export const sessionStep = (label: string, before: Snapshot, merge?: Step["merge"]): Step => ({
  label,
  change: { kind: "session", before },
  merge,
});

export const fileStep = (label: string, action: FileAction): Step => ({ label, change: { kind: "file", action } });

// A further edit to the same param soon after the last step joins that step.
function joinsLast(last: Step | undefined, merge: Step["merge"]): boolean {
  if (!last?.merge || !merge) return false;
  return last.merge.key === merge.key && merge.at - last.merge.at <= MERGE_MS;
}

// Record a step about to happen (or, for files, just done). Clears redo.
export function record(h: History, step: Step): History {
  const last = h.past.at(-1);
  if (joinsLast(last, step.merge)) {
    return { past: [...h.past.slice(0, -1), { ...last!, merge: step.merge }], future: [] };
  }
  return { past: [...h.past, step].slice(-HISTORY_DEPTH), future: [] };
}

// After an undo or redo no later edit joins an earlier step.
const sealed = (steps: readonly Step[]): Step[] =>
  steps.map((st, i) => (i === steps.length - 1 ? { label: st.label, change: st.change } : st));

// A session step taken back or redone holds `now`, so going the other way returns to it. A file
// step moves as it is.
const swapped = (step: Step, now: Snapshot): Step =>
  step.change.kind === "session" ? sessionStep(step.label, now) : { label: step.label, change: step.change };

// Move the newest step of `from` onto `to`: undo moves past to future, redo moves it back.
// `change` is what to apply: the snapshot to restore, or the file action to run.
function shift(from: readonly Step[], to: readonly Step[], now: Snapshot) {
  const step = from.at(-1);
  if (!step) return null;
  const moved = swapped(step, now);
  return { from: sealed(from.slice(0, -1)), to: [...to, moved], change: step.change, moved };
}

export interface Travel {
  history: History;
  change: Change;
  moved: Step; // the step as it now sits on the other side; `discard` it if the change fails
}

// Undo: what to apply, with the current state kept for redo. Null with nothing to undo.
export function undo(h: History, now: Snapshot): Travel | null {
  const r = shift(h.past, h.future, now);
  return r && { history: { past: r.from, future: r.to }, change: r.change, moved: r.moved };
}

export function redo(h: History, now: Snapshot): Travel | null {
  const r = shift(h.future, h.past, now);
  return r && { history: { past: r.to, future: r.from }, change: r.change, moved: r.moved };
}

// Drop a step whose file action failed.
export const discard = (h: History, step: Step): History => ({
  past: h.past.filter((s) => s !== step),
  future: h.future.filter((s) => s !== step),
});

// Opening a set: session steps no longer apply, library file steps still do.
export const keepFileSteps = (h: History): History => ({
  past: sealed(h.past.filter((s) => s.change.kind === "file")),
  future: h.future.filter((s) => s.change.kind === "file"),
});

export const undoLabel = (h: History): string | null => h.past.at(-1)?.label ?? null;
export const redoLabel = (h: History): string | null => h.future.at(-1)?.label ?? null;
