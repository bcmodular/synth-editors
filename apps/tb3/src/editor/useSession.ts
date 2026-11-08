// Patch session: the open set's 16 slots, the active patch (a slot, or the unslotted buffer),
// preview/grab, STORE and morph. See docs/tb3-phase3-design.md.
//
// The state rules are plain functions in sessionState.ts; the TB-3 side (what it holds, diffed
// sends, the morph pump) is in useTb3Link.ts. This hook wires the two to React.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Patch } from "../core/patch";
import type { Slot, Slots } from "../core/patchSet";
import { persistSession, restoreSession } from "./sessionPersist";
import * as rules from "./sessionState";
import type { MorphState, SessionState } from "./sessionState";
import { useLatest } from "./useLatest";
import type { Latest } from "./useLatest";
import { useTb3Link } from "./useTb3Link";
import { useUndo } from "./useUndo";

export type { SessionState } from "./sessionState";
export { currentPatch } from "./sessionState";
export { MORPH_RATES } from "./sessionPersist";

// Slot click modes: delete clears, grab auditions while held, target picks the morph target.
export type SlotMode = "delete" | "grab" | "target" | null;

type Link = ReturnType<typeof useTb3Link>;

// The session survives quitting: saved shortly after each change, and on unload.
function usePersistedSession() {
  const store = useLatest<SessionState>(restoreSession);
  const { state, ref } = store;
  useEffect(() => {
    const t = setTimeout(() => persistSession(state), 400);
    return () => clearTimeout(t);
  }, [state]);
  useEffect(() => {
    // Quitting or reloading inside the debounce window must not lose the last edits.
    const flush = () => persistSession(ref.current);
    window.addEventListener("beforeunload", flush);
    return () => window.removeEventListener("beforeunload", flush);
  }, [ref]);
  return store;
}

// Hold-to-audition (browser preview button, Option + slot): the editor shows the auditioned
// patch, read only; release sends the active patch back.
function usePreview(link: Link, active: () => Patch | null) {
  const on = useRef(false);
  const [shown, setShown] = useState<{ key: string; name: string; patch: Patch } | null>(null);
  const { sendPatch } = link;

  const preview = useCallback(
    (p: Patch, key: string, name: string) => {
      on.current = true;
      setShown({ key, name, patch: p });
      sendPatch(p);
    },
    [sendPatch],
  );

  const endPreview = useCallback(() => {
    if (!on.current) return;
    on.current = false;
    setShown(null);
    const cur = active();
    if (cur) sendPatch(cur);
  }, [active, sendPatch]);

  return { previewing: on, shown, preview, endPreview };
}

type SessionStore = Latest<SessionState>;
type MorphStore = Latest<MorphState>;

// Morph and CLEAR. While previewing, the editor's patch changes but the TB-3 keeps the audition.
function useMorph(session: SessionStore, morphs: MorphStore, link: Link, undo: UndoStore) {
  const { commit } = session;
  const { previewing, remember } = undo;
  const { sendPatch, pumpTo } = link;

  const chooseMorphTarget = useCallback((i: number) => morphs.commit(rules.chooseMorphTarget(i)), [morphs]);

  const clearMorph = useCallback(() => {
    const { session: next, reverted } = rules.clearMorph(session.ref.current, morphs.ref.current);
    if (reverted) remember("Morph CLEAR");
    morphs.commit(rules.noMorph);
    if (!reverted) return;
    commit(next);
    if (!previewing.current) sendPatch(reverted);
  }, [commit, morphs, previewing, remember, sendPatch, session.ref]);

  const setMorph = useCallback(
    (amount: number) => {
      const step = rules.morphStep(session.ref.current, morphs.ref.current, amount);
      if (!step) return;
      morphs.commit(step.morph);
      commit(step.session);
      if (!previewing.current) pumpTo(rules.currentPatch(step.session)!);
    },
    [commit, morphs, previewing, pumpTo, session.ref],
  );

  return { chooseMorphTarget, clearMorph, setMorph };
}

// Edits, recall, loading and sync: each changes the active patch and sends it.
function usePatchActions(session: SessionStore, morphs: MorphStore, link: Link, undo: UndoStore) {
  const { ref, commit } = session;
  const { previewing, remember } = undo;
  const { sendPatch, sendEdit, holds } = link;
  const restartMorph = useCallback(() => morphs.commit(rules.restartMorph(morphs.ref.current)), [morphs]);

  // Apply an edit to the active patch; `msg` is its DT1, coalesced by `key` in the edit queue and
  // in the undo history (`label` names the param there). Editing turns a morph blend into the
  // active patch's edits.
  const edit = useCallback(
    (fn: (p: Patch) => Patch, key: string, msg: number[], label: string) => {
      const result = previewing.current ? null : rules.editCurrent(ref.current, fn); // previewing: read only
      if (!result) return;
      remember(label, key);
      sendEdit(result.before, result.patch, key, msg);
      commit(result.session);
      if (morphs.ref.current.base) restartMorph();
    },
    [commit, morphs, previewing, ref, remember, restartMorph, sendEdit],
  );

  const recall = useCallback(
    (i: number) => {
      const next = rules.recallSlot(ref.current, i);
      if (!next) return;
      commit(next);
      sendPatch(rules.currentPatch(next)!);
      restartMorph();
    },
    [commit, ref, restartMorph, sendPatch],
  );

  // Load a patch file into the unslotted buffer (not into the set) and send it.
  const load = useCallback(
    (p: Patch, name: string) => {
      commit(rules.loadBuffer(ref.current, p, name));
      sendPatch(p);
      restartMorph();
    },
    [commit, ref, restartMorph, sendPatch],
  );

  // Sync from TB-3: the TB-3's patch becomes the unslotted buffer.
  const fromTb3 = useCallback(
    (p: Patch) => {
      holds(p);
      commit(rules.loadBuffer(ref.current, p, null));
      restartMorph();
    },
    [commit, holds, ref, restartMorph],
  );

  return { edit, recall, load, fromTb3 };
}

// STORE, Replace, DELETE, rename, and opening or saving a set: no sends.
function useSetEdits(session: SessionStore, morphs: MorphStore, undo: UndoStore) {
  const { ref, commit } = session;
  const { remember, forget } = undo;
  // Apply a rule as an undoable step called `label`. A rule may decline (null): nothing changes then.
  const apply = useCallback(
    (label: string, next: SessionState | null) => {
      if (!next) return;
      remember(label);
      commit(next);
    },
    [commit, remember],
  );
  const filled = useCallback((i: number) => ref.current.slots[i] !== null, [ref]);

  const store = useCallback(
    (i: number) => apply(`${filled(i) ? "Replace" : "STORE"} slot ${i + 1}`, rules.storeSlot(ref.current, i)),
    [apply, filled, ref],
  );
  const loadIntoSlot = useCallback(
    (i: number, slot: Slot) => apply(`Replace slot ${i + 1}`, rules.replaceSlot(ref.current, i, slot)),
    [apply, ref],
  );
  const rename = useCallback(
    (i: number, name: string) => apply(`Rename slot ${i + 1}`, rules.renameSlot(ref.current, i, name)),
    [apply, ref],
  );
  const markSaved = useCallback((path: string) => commit(rules.markSaved(ref.current, path)), [commit, ref]);

  const clear = useCallback(
    (i: number) => {
      if (!filled(i)) return;
      apply(`DELETE slot ${i + 1}`, rules.deleteSlot(ref.current, i));
      morphs.commit(rules.morphAfterDelete(morphs.ref.current, i));
    },
    [apply, filled, morphs, ref],
  );

  const openSet = useCallback(
    (path: string | null, slots: Slots) => {
      commit(rules.openSet(ref.current, path, slots));
      morphs.commit(rules.noMorph);
      forget();
    },
    [commit, forget, morphs, ref],
  );

  return { store, loadIntoSlot, clear, rename, openSet, markSaved };
}

type UndoStore = ReturnType<typeof useUndo>;

export function useSession(sendTb3: (msg: number[]) => void, onError: (msg: string) => void) {
  const session = usePersistedSession();
  const morphs = useLatest<MorphState>(rules.noMorph);
  const link = useTb3Link(sendTb3);
  const active = useCallback(() => rules.currentPatch(session.ref.current), [session.ref]);
  const { previewing, shown, preview, endPreview } = usePreview(link, active);
  const [mode, setMode] = useState<SlotMode>(null);
  const { state } = session;
  const { modified, dirty } = useMemo(() => rules.saveStatus(state), [state]);
  const { sendAll: sendAllOf } = link;
  const sendAll = useCallback(() => {
    const cur = active();
    if (cur) sendAllOf(cur);
  }, [active, sendAllOf]);
  const undo = useUndo({ session, morphs, sendPatch: link.sendPatch, previewing, onError });
  const patchActions = usePatchActions(session, morphs, link, undo);
  const setEdits = useSetEdits(session, morphs, undo);
  const morphActions = useMorph(session, morphs, link, undo);

  return {
    state,
    patch: shown?.patch ?? rules.currentPatch(state), // what the editor shows
    activePatch: rules.currentPatch(state),
    currentName: rules.currentName(state),
    previewKey: shown?.key ?? null,
    previewName: shown?.name ?? null,
    modified,
    dirty,
    mode,
    setMode,
    morphTarget: morphs.state.target,
    morphAmount: morphs.state.amount,
    morphRate: link.morphRate,
    setMorphRate: link.setMorphRate,
    push: link.push, // sends outside the patch (global tuning), coalesced like edits
    preview,
    endPreview,
    sendAll,
    undo: undo.undo,
    redo: undo.redo,
    undoLabel: undo.undoLabel, // the step undo would take back; null = nothing to undo
    redoLabel: undo.redoLabel,
    rememberFile: undo.rememberFile, // a library file step, once done
    ...patchActions,
    ...setEdits,
    ...morphActions,
  };
}

export type Session = ReturnType<typeof useSession>;
