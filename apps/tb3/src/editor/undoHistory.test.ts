import { describe, expect, it } from "vitest";
import { demoPatch } from "./demoPatch";
import { chooseMorphTarget, deleteSlot, freshSession, markSaved, noMorph, storeSlot, loadBuffer } from "./sessionState";
import {
  HISTORY_DEPTH,
  MERGE_MS,
  emptyHistory,
  record,
  redo,
  redoLabel,
  restoreSnapshot,
  takeSnapshot,
  undo,
  undoLabel,
} from "./undoHistory";
import type { History, Snapshot } from "./undoHistory";

// A distinct snapshot per number, told apart by the active slot.
const snap = (n: number): Snapshot => ({ ...takeSnapshot(freshSession(), noMorph), active: n });
const step = (n: number, label = `step ${n}`) => ({ label, before: snap(n) });
const edit = (n: number, key: string, at: number) => ({ label: `edit ${key}`, before: snap(n), merge: { key, at } });

describe("undo history", () => {
  it("undoes and redoes in order", () => {
    let h: History = record(record(emptyHistory, step(0)), step(1));
    expect(undoLabel(h)).toBe("step 1");
    const u1 = undo(h, snap(2))!;
    expect(u1.restore).toEqual(snap(1));
    const u2 = undo(u1.history, u1.restore)!;
    expect(u2.restore).toEqual(snap(0));
    expect(undo(u2.history, u2.restore)).toBeNull();
    expect(redoLabel(u2.history)).toBe("step 0");
    const r1 = redo(u2.history, u2.restore)!;
    expect(r1.restore).toEqual(snap(1));
    const r2 = redo(r1.history, r1.restore)!;
    expect(r2.restore).toEqual(snap(2));
    h = r2.history;
    expect(redo(h, snap(2))).toBeNull();
    expect(undoLabel(h)).toBe("step 1");
  });

  it("a new step clears redo", () => {
    const u = undo(record(emptyHistory, step(0)), snap(1))!;
    expect(redoLabel(record(u.history, step(5)))).toBeNull();
  });

  it("keeps at most the last HISTORY_DEPTH steps", () => {
    let h = emptyHistory;
    for (let i = 0; i < HISTORY_DEPTH + 5; i++) h = record(h, step(i));
    expect(h.past).toHaveLength(HISTORY_DEPTH);
    expect(h.past[0]!.before).toEqual(snap(5));
  });

  it("merges edits to one param in quick succession into the first step", () => {
    let h = emptyHistory;
    for (let i = 0; i < 5; i++) h = record(h, edit(i, "cutoff", i * (MERGE_MS / 2)));
    expect(h.past).toHaveLength(1);
    expect(undo(h, snap(9))!.restore).toEqual(snap(0));
  });

  it("starts a new step for another param, after a pause, or after another action", () => {
    expect(record(record(emptyHistory, edit(0, "cutoff", 0)), edit(1, "reso", 10)).past).toHaveLength(2);
    expect(record(record(emptyHistory, edit(0, "cutoff", 0)), edit(1, "cutoff", MERGE_MS + 1)).past).toHaveLength(2);
    const h = record(record(record(emptyHistory, edit(0, "cutoff", 0)), step(1)), edit(2, "cutoff", 10));
    expect(h.past).toHaveLength(3);
  });

  it("an edit after an undo doesn't join the step before", () => {
    const h = record(record(emptyHistory, edit(0, "cutoff", 0)), step(1));
    const u = undo(h, snap(2))!;
    expect(record(u.history, edit(3, "cutoff", 10)).past).toHaveLength(2);
  });
});

describe("snapshots", () => {
  it("restore the slots, active patch and morph, but not the saved state", () => {
    const before = loadBuffer(storeSlot(loadBuffer(freshSession(), demoPatch(), "x.syx"), 2)!, demoPatch(), "y");
    const morph = chooseMorphTarget(2);
    const s = takeSnapshot(before, morph);
    const later = markSaved(deleteSlot(before, 2), "saved.tb3set");
    const back = restoreSnapshot(later, s);
    expect(back.morph).toBe(morph);
    expect(back.session.slots).toBe(before.slots);
    expect(back.session.buffer).toBe(before.buffer);
    expect(back.session.bufferName).toBe("y");
    expect(back.session.setPath).toBe("saved.tb3set");
    expect(back.session.savedKeys).toBe(later.savedKeys);
  });
});
