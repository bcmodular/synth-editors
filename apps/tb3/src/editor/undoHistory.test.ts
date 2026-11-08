import { describe, expect, it } from "vitest";
import { demoPatch } from "./demoPatch";
import { chooseMorphTarget, deleteSlot, freshSession, markSaved, noMorph, storeSlot, loadBuffer } from "./sessionState";
import {
  HISTORY_DEPTH,
  MERGE_MS,
  discard,
  emptyHistory,
  fileStep,
  keepFileSteps,
  record,
  redo,
  redoLabel,
  restoreSnapshot,
  sessionStep,
  takeSnapshot,
  undo,
  undoLabel,
} from "./undoHistory";
import type { History, Snapshot, Travel } from "./undoHistory";

// A distinct snapshot per number, told apart by the active slot.
const snap = (n: number): Snapshot => ({ ...takeSnapshot(freshSession(), noMorph), active: n });
const step = (n: number, label = `step ${n}`) => sessionStep(label, snap(n));
const edit = (n: number, key: string, at: number) => sessionStep(`edit ${key}`, snap(n), { key, at });
const restored = (t: Travel) => (t.change.kind === "session" ? t.change.before : null);

describe("undo history", () => {
  // Take `n` steps with `go` from `now`, returning the snapshots restored and the history after.
  function walk(go: typeof undo, h: History, now: Snapshot, n: number) {
    const seen: (Snapshot | null)[] = [];
    for (let i = 0; i < n; i++) {
      const t = go(h, now)!;
      seen.push(restored(t));
      h = t.history;
      now = restored(t)!;
    }
    return { seen, h, now };
  }

  it("undoes and redoes in order", () => {
    const h = record(record(emptyHistory, step(0)), step(1));
    expect(undoLabel(h)).toBe("step 1");
    const back = walk(undo, h, snap(2), 2);
    expect(back.seen).toEqual([snap(1), snap(0)]);
    expect(undo(back.h, back.now)).toBeNull();
    expect(redoLabel(back.h)).toBe("step 0");
    const forth = walk(redo, back.h, back.now, 2);
    expect(forth.seen).toEqual([snap(1), snap(2)]);
    expect(redo(forth.h, forth.now)).toBeNull();
    expect(undoLabel(forth.h)).toBe("step 1");
  });

  it("a new step clears redo", () => {
    const u = undo(record(emptyHistory, step(0)), snap(1))!;
    expect(redoLabel(record(u.history, step(5)))).toBeNull();
  });

  it("keeps at most the last HISTORY_DEPTH steps", () => {
    let h = emptyHistory;
    for (let i = 0; i < HISTORY_DEPTH + 5; i++) h = record(h, step(i));
    expect(h.past).toHaveLength(HISTORY_DEPTH);
    expect(h.past[0]!.change).toEqual({ kind: "session", before: snap(5) });
  });

  it("merges edits to one param in quick succession into the first step", () => {
    let h = emptyHistory;
    for (let i = 0; i < 5; i++) h = record(h, edit(i, "cutoff", i * (MERGE_MS / 2)));
    expect(h.past).toHaveLength(1);
    expect(restored(undo(h, snap(9))!)).toEqual(snap(0));
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

describe("library file steps", () => {
  const noop = () => Promise.resolve();
  const action = { undo: noop, redo: noop };

  it("undo and redo hand back the file action, mixed in with session steps", () => {
    const h = record(record(emptyHistory, step(0)), fileStep("Rename Acid", action));
    const changes = (go: typeof undo, from: History) => {
      const first = go(from, snap(1))!;
      const second = go(first.history, snap(1))!;
      return { kinds: [first.change.kind, second.change.kind], h: second.history };
    };
    const back = changes(undo, h);
    expect(back.kinds).toEqual(["file", "session"]);
    expect(redoLabel(back.h)).toBe("step 0");
    expect(changes(redo, back.h).kinds).toEqual(["session", "file"]);
  });

  it("a failed file step is dropped", () => {
    const u = undo(record(record(emptyHistory, step(0)), fileStep("Rename Acid", action)), snap(1))!;
    const h = discard(u.history, u.moved);
    expect(h.future).toHaveLength(0);
    expect(undoLabel(h)).toBe("step 0");
  });

  it("opening a set keeps only the file steps", () => {
    const h = record(record(record(emptyHistory, step(0)), fileStep("Move Bass", action)), step(1));
    const u = undo(h, snap(2))!;
    const kept = keepFileSteps(u.history);
    expect(kept.past.map((s) => s.label)).toEqual(["Move Bass"]);
    expect(kept.future).toHaveLength(0);
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
