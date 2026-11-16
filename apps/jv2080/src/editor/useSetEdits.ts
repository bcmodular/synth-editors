// The open set's slots, after apps/tb3/src/editor/useSession.ts: recall, audition, loading a file, STORE, Replace,
// DELETE, swap, copy, rename, revert to saved, and opening or saving a set. Each that changes the session is an
// undo step; each that changes the active patch sends it to the JV (as the bytes that differ).
import { useCallback, useMemo, useState } from "react";
import type { Patch } from "../core/patch";
import type { Slot, Slots } from "../core/patchSet";
import * as rules from "./sessionState";
import type { Move, SessionState } from "./sessionState";
import type { JvSender } from "./useJvSender";
import type { Latest } from "./useLatest";
import type { Undo } from "./useUndo";

type Store = Latest<SessionState>;

// What every part of the session works on: the state, the JV's side, the undo history, and whether an audition is on.
export interface SessionCore {
  store: Store;
  sender: JvSender;
  undo: Undo;
  previewing: { current: boolean };
}

// Slot click modes: delete clears, grab auditions while held.
export type SlotMode = "delete" | "grab" | null;

// Hold-to-audition (a library file's ▶, Option + slot, GRAB): the editor shows the auditioned patch, read only;
// release sends the active patch back.
function usePreview(store: Store, sender: JvSender, previewing: { current: boolean }) {
  const [shown, setShown] = useState<{ key: string; name: string; patch: Patch } | null>(null);
  const { sendPatch } = sender;
  const preview = useCallback((p: Patch, key: string, name: string) => {
    previewing.current = true;
    setShown({ key, name, patch: p });
    sendPatch(p);
  }, [previewing, sendPatch]);
  const endPreview = useCallback(() => {
    if (!previewing.current) return;
    previewing.current = false;
    setShown(null);
    const cur = rules.currentPatch(store.ref.current);
    if (cur) sendPatch(cur);
  }, [previewing, sendPatch, store.ref]);
  return { shown, preview, endPreview };
}

// Recall and loading a file: each changes the active patch and sends it.
// Recall isn't an undo step (the slot keeps its patch); loading a file is, as it replaces the buffer.
function useRecall(store: Store, sender: JvSender, undo: Undo) {
  const { sendPatch } = sender;
  const { remember } = undo;
  const recall = useCallback((i: number) => {
    const next = rules.recallSlot(store.ref.current, i);
    if (!next) return;
    store.commit(next);
    sendPatch(rules.currentPatch(next)!);
  }, [remember, sendPatch, store]);
  // A patch file into the unslotted buffer (not into the set).
  const load = useCallback((p: Patch, name: string) => {
    remember(`Load ${name}`);
    store.commit(rules.loadBuffer(store.ref.current, p, name));
    sendPatch(p);
  }, [remember, sendPatch, store]);
  return { recall, load };
}

// STORE, Replace, DELETE, swap, copy, rename, and opening or saving a set: no sends.
function useSlotEdits(store: Store, undo: Undo) {
  const { ref, commit } = store;
  const { remember, forget } = undo;
  // Apply a rule as an undoable step called `label`. A rule may decline (null): nothing changes then.
  const apply = useCallback((label: string, next: SessionState | null) => {
    if (!next) return;
    remember(label);
    commit(next);
  }, [commit, remember]);
  const filled = useCallback((i: number) => ref.current.slots[i] !== null, [ref]);

  return {
    store: useCallback((i: number) =>
      apply(`${filled(i) ? "Replace" : "STORE"} slot ${i + 1}`, rules.storeSlot(ref.current, i)), [apply, filled, ref]),
    loadIntoSlot: useCallback((i: number, slot: Slot) =>
      apply(`Replace slot ${i + 1}`, rules.replaceSlot(ref.current, i, slot)), [apply, ref]),
    rename: useCallback((i: number, name: string) =>
      apply(`Rename slot ${i + 1}`, rules.renameSlot(ref.current, i, name)), [apply, ref]),
    clear: useCallback((i: number) => {
      if (filled(i)) apply(`DELETE slot ${i + 1}`, rules.deleteSlot(ref.current, i));
    }, [apply, filled, ref]),
    swap: useCallback((move: Move) => apply(rules.swapLabel(ref.current, move), rules.swapSlots(ref.current, move)), [apply, ref]),
    copy: useCallback((move: Move) =>
      apply(`Copy slot ${move.from + 1} to ${move.to + 1}`, rules.copySlot(ref.current, move)), [apply, ref]),
    openSet: useCallback((path: string | null, slots: Slots) => {
      commit(rules.openSet(ref.current, path, slots));
      forget();
    }, [commit, forget, ref]),
    markSaved: useCallback((path: string) => commit(rules.markSaved(ref.current, path)), [commit, ref]),
  };
}

// Revert to saved, for a slot or the whole set: an undoable step. If the active patch changes it is sent (unless
// auditioning, when the release sends it).
function useRevert(store: Store, sender: JvSender, undo: Undo, previewing: { current: boolean }) {
  const { sendPatch } = sender;
  const { remember } = undo;
  const apply = useCallback((label: string, next: SessionState | null) => {
    if (!next) return;
    const before = rules.currentPatch(store.ref.current);
    remember(label);
    store.commit(next);
    const cur = rules.currentPatch(next);
    if (!cur || cur === before) return;
    if (!previewing.current) sendPatch(cur);
  }, [previewing, remember, sendPatch, store]);
  return {
    revertSlot: useCallback((i: number) => apply(`Revert slot ${i + 1}`, rules.revertSlot(store.ref.current, i)), [apply, store.ref]),
    revertSet: useCallback(() => apply("Revert set", rules.revertSet(store.ref.current)), [apply, store.ref]),
  };
}

export function useSetEdits({ store, sender, undo, previewing }: SessionCore) {
  const [mode, setMode] = useState<SlotMode>(null);
  const { state } = store;
  const status = useMemo(() => rules.saveStatus(state), [state]);
  const { shown, preview, endPreview } = usePreview(store, sender, previewing);
  return {
    shown,
    previewKey: shown?.key ?? null,
    previewName: shown?.name ?? null,
    preview,
    endPreview,
    mode,
    setMode,
    modified: status.modified,
    changed: status.changed, // differs from the saved set, so Revert to saved applies
    dirty: status.dirty,
    ...useRecall(store, sender, undo),
    ...useSlotEdits(store, undo),
    ...useRevert(store, sender, undo, previewing),
  };
}
