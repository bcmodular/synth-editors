// Undo and redo: session snapshots taken by `remember` just before each undoable action, and
// library file steps recorded by `rememberFile` once done. Off while previewing (the editor shows
// the auditioned patch, read only) and while a file step is running. See undoHistory.ts.
import { useCallback, useRef } from "react";
import type { Patch } from "../core/patch";
import { currentPatch } from "./sessionState";
import type { MorphState, SessionState } from "./sessionState";
import * as history from "./undoHistory";
import type { History } from "./undoHistory";
import { useLatest } from "./useLatest";
import type { Latest } from "./useLatest";

interface UndoDeps {
  session: Latest<SessionState>;
  morphs: Latest<MorphState>;
  sendPatch: (p: Patch) => void;
  previewing: { current: boolean };
  onError: (msg: string) => void;
}

// Put a session snapshot back, and the TB-3 in line with it.
function useRestore({ session, morphs, sendPatch }: UndoDeps) {
  return useCallback(
    (snap: history.Snapshot) => {
      const back = history.restoreSnapshot(session.ref.current, snap);
      session.commit(back.session);
      morphs.commit(back.morph);
      const cur = currentPatch(back.session);
      if (cur) sendPatch(cur);
    },
    [morphs, sendPatch, session],
  );
}

// A file step runs after the history has moved; if it fails, it is dropped and nothing changes.
function useRunFile(hist: Latest<History>, onError: (msg: string) => void) {
  const busy = useRef(false);
  const run = useCallback(
    (action: () => Promise<void>, step: history.Step, verb: string) => {
      busy.current = true;
      action()
        .catch((e: unknown) => {
          hist.commit(history.discard(hist.ref.current, step));
          onError(`Couldn't ${verb} ${step.label}: ${e instanceof Error ? e.message : String(e)}`);
        })
        .finally(() => {
          busy.current = false;
        });
    },
    [hist, onError],
  );
  return { busy, run };
}

export function useUndo(deps: UndoDeps) {
  const { session, morphs, previewing } = deps;
  const hist = useLatest<History>(history.emptyHistory);
  const restore = useRestore(deps);
  const { busy, run: runFile } = useRunFile(hist, deps.onError);
  const snapshot = useCallback(
    () => history.takeSnapshot(session.ref.current, morphs.ref.current),
    [morphs.ref, session.ref],
  );
  const add = useCallback((step: history.Step) => hist.commit(history.record(hist.ref.current, step)), [hist]);

  // `mergeKey`: edits to one param in quick succession are one step.
  const remember = useCallback(
    (label: string, mergeKey?: string) =>
      add(history.sessionStep(label, snapshot(), mergeKey === undefined ? undefined : { key: mergeKey, at: performance.now() })),
    [add, snapshot],
  );
  const rememberFile = useCallback(
    (label: string, action: history.FileAction) => add(history.fileStep(label, action)),
    [add],
  );

  // Opening a set: its session steps no longer apply; library file steps still do.
  const forget = useCallback(() => hist.commit(history.keepFileSteps(hist.ref.current)), [hist]);

  const travel = useCallback(
    (go: typeof history.undo, verb: "undo" | "redo") => {
      const r = previewing.current || busy.current ? null : go(hist.ref.current, snapshot());
      if (!r) return;
      hist.commit(r.history);
      if (r.change.kind === "session") restore(r.change.before);
      else runFile(r.change.action[verb], r.moved, verb);
    },
    [busy, hist, previewing, restore, runFile, snapshot],
  );

  return {
    previewing,
    remember,
    rememberFile,
    forget,
    undo: useCallback(() => travel(history.undo, "undo"), [travel]),
    redo: useCallback(() => travel(history.redo, "redo"), [travel]),
    undoLabel: history.undoLabel(hist.state),
    redoLabel: history.redoLabel(hist.state),
  };
}
