import { describe, expect, it } from "vitest";
import { getRaw, setRaw } from "../core/patch";
import type { Patch } from "../core/patch";
import { slotKey } from "../core/patchSet";
import type { Slots } from "../core/patchSet";
import { paramById } from "../core/params";
import { demoPatch } from "./demoPatch";
import {
  chooseMorphTarget,
  clearMorph,
  currentName,
  currentPatch,
  deleteSlot,
  editCurrent,
  freshSession,
  loadBuffer,
  markSaved,
  morphAfterDelete,
  morphStep,
  noMorph,
  openSet,
  recallSlot,
  renameSlot,
  replaceSlot,
  restartMorph,
  saveStatus,
  storeSlot,
} from "./sessionState";
import type { SessionState } from "./sessionState";

const cutoff = paramById("vcf_cutoff");
const withCutoff = (v: number): Patch => setRaw(demoPatch(), cutoff, v);

const A = withCutoff(10);
const B = withCutoff(100);
const C = withCutoff(50);

// A set with A in slot 0 and B in slot 1, saved, with slot 0 active.
function session(over: Partial<SessionState> = {}): SessionState {
  const slots: Slots = freshSession().slots.map((_, i) => [{ name: "A", patch: A }, { name: "B", patch: B }][i] ?? null);
  return { ...freshSession(), setPath: "set.tb3set", slots, savedKeys: slots.map(slotKey), active: 0, ...over };
}

const buffered = () => loadBuffer(session(), C, "C.syx");

describe("active patch", () => {
  it("is the active slot's patch, or the buffer", () => {
    expect(currentPatch(session())).toBe(A);
    expect(currentName(session())).toBe("A");
    expect(currentPatch(buffered())).toBe(C);
    expect(currentName(buffered())).toBe("C.syx");
    expect(currentPatch(freshSession())).toBeNull();
  });

  it("edits go to the active slot", () => {
    const r = editCurrent(session(), (p) => setRaw(p, cutoff, 77))!;
    expect(r.before).toBe(A);
    expect(getRaw(r.session.slots[0]!.patch, cutoff)).toBe(77);
    expect(r.session.slots[0]!.name).toBe("A");
    expect(r.session.buffer).toBeNull();
  });

  it("edits go to the buffer when no slot is active", () => {
    const r = editCurrent(buffered(), (p) => setRaw(p, cutoff, 77))!;
    expect(getRaw(r.session.buffer!, cutoff)).toBe(77);
    expect(r.session.slots).toEqual(buffered().slots);
  });

  it("there is nothing to edit in a fresh session", () => {
    expect(editCurrent(freshSession(), (p) => p)).toBeNull();
  });
});

describe("recall and load", () => {
  it("recalls a filled slot and ignores an empty one", () => {
    expect(recallSlot(session(), 1)!.active).toBe(1);
    expect(recallSlot(session(), 5)).toBeNull();
  });

  it("loads a patch into the buffer and leaves the set alone", () => {
    const s = buffered();
    expect(s.active).toBeNull();
    expect(s.slots).toEqual(session().slots);
    expect(loadBuffer(s, B, null).bufferName).toBeNull();
  });
});

describe("STORE", () => {
  it("stores the active patch in a slot under its name and makes that slot active", () => {
    const s = storeSlot(session(), 4)!;
    expect(s.slots[4]).toEqual({ name: "A", patch: A });
    expect(s.active).toBe(4);
  });

  it("stores the buffer under its file name, or Untitled", () => {
    expect(storeSlot(buffered(), 2)!.slots[2]!.name).toBe("C.syx");
    expect(storeSlot(loadBuffer(session(), C, null), 2)!.slots[2]!.name).toBe("Untitled");
  });

  it("does nothing without a patch", () => {
    expect(storeSlot(freshSession(), 0)).toBeNull();
  });
});

describe("DELETE and Replace", () => {
  it("deleting another slot leaves the active patch alone", () => {
    const s = deleteSlot(session(), 1);
    expect(s.slots[1]).toBeNull();
    expect(s.active).toBe(0);
  });

  it("deleting the active slot keeps its patch in the buffer", () => {
    const s = deleteSlot(session(), 0);
    expect(s.slots[0]).toBeNull();
    expect(s.active).toBeNull();
    expect(s.buffer).toBe(A);
    expect(s.bufferName).toBe("A");
    expect(currentPatch(s)).toBe(A);
  });

  it("replacing the active slot keeps what it held in the buffer", () => {
    const s = replaceSlot(session(), 0, { name: "C", patch: C });
    expect(s.slots[0]).toEqual({ name: "C", patch: C });
    expect(currentPatch(s)).toBe(A);
  });
});

describe("rename", () => {
  it("trims the name and refuses a blank one or an empty slot", () => {
    expect(renameSlot(session(), 0, "  Acid  ")!.slots[0]!.name).toBe("Acid");
    expect(renameSlot(session(), 0, "   ")).toBeNull();
    expect(renameSlot(session(), 5, "X")).toBeNull();
  });
});

describe("sets", () => {
  it("opening a set keeps the editor on the patch it showed, as the buffer", () => {
    const s = openSet(session(), "other.tb3set", freshSession().slots);
    expect(s.setPath).toBe("other.tb3set");
    expect(s.active).toBeNull();
    expect(s.buffer).toBe(A);
    expect(s.bufferName).toBe("A");
    expect(saveStatus(s).dirty).toBe(false);
  });

  it("tracks which slots differ from the saved set until it is saved", () => {
    const s = deleteSlot(storeSlot(session(), 3)!, 1);
    const { modified, dirty } = saveStatus(s);
    expect(dirty).toBe(true);
    expect(modified[3]).toBe(true);
    expect(modified[1]).toBe(false); // deleted: nothing to mark
    expect(modified[0]).toBe(false);
    const saved = markSaved(s, "new.tb3set");
    expect(saved.setPath).toBe("new.tb3set");
    expect(saveStatus(saved).dirty).toBe(false);
  });
});

describe("morph", () => {
  it("does nothing without a target", () => {
    expect(morphStep(session(), noMorph, 64)).toBeNull();
  });

  it("blends from the patch the morph started on, not from the last blend", () => {
    const m = chooseMorphTarget(1);
    const half = morphStep(session(), m, 64)!;
    expect(half.morph).toEqual({ target: 1, amount: 64, base: A });
    expect(getRaw(currentPatch(half.session)!, cutoff)).toBeCloseTo(10 + 90 * (64 / 127), -1);
    const full = morphStep(half.session, half.morph, 127)!;
    expect(full.morph.base).toBe(A);
    expect(currentPatch(full.session)).toEqual(B);
    expect(full.session.slots[1]!.patch).toBe(B); // the target slot is untouched
  });

  it("CLEAR goes back to the patch from before the morph", () => {
    const step = morphStep(session(), chooseMorphTarget(1), 90)!;
    const r = clearMorph(step.session, step.morph);
    expect(r.reverted).toBe(A);
    expect(currentPatch(r.session)).toBe(A);
  });

  it("CLEAR before the fader moved changes nothing", () => {
    const r = clearMorph(session(), chooseMorphTarget(1));
    expect(r.reverted).toBeNull();
    expect(r.session).toEqual(session());
  });

  it("restarting keeps the blend as the new base on the next move", () => {
    const step = morphStep(session(), chooseMorphTarget(1), 64)!;
    const m = restartMorph(step.morph);
    expect(m).toEqual({ target: 1, amount: 0, base: null });
    expect(morphStep(step.session, m, 10)!.morph.base).toBe(currentPatch(step.session));
  });

  it("deleting the target slot drops the target", () => {
    const m = chooseMorphTarget(1);
    expect(morphAfterDelete(m, 1).target).toBeNull();
    expect(morphAfterDelete(m, 2)).toBe(m);
  });
});
