// Undo and redo, after apps/tb3/src/editor/useUndo.ts: session snapshots taken by `remember` just before each
// undoable action, and library file steps recorded by `rememberFile` once done. Off while auditioning (the editor
// shows the auditioned patch, read only) and while a file step is running. See undoHistory.ts.
import { useCallback, useRef } from "react";
import type { Patch } from "../core/patch";
import { currentPatch, type SessionState } from "./sessionState";
import { mergeFor } from "./undoGesture";
import * as history from "./undoHistory";
import type { History } from "./undoHistory";
import { useLatest, type Latest } from "./useLatest";

export interface UndoDeps {
  session: Latest<SessionState>;
  sendPatch: (p: Patch) => void;
  previewing: { current: boolean };
  onError: (msg: string) => void;
}

// A file step runs after the history has moved; if it fails, it is dropped and nothing changes.
function useRunFile(hist: Latest<History>, onError: (msg: string) => void) {
  const busy = useRef(false);
  const run = useCallback((action: () => Promise<void>, step: history.Step, verb: string) => {
    busy.current = true;
    action()
      .catch((e: unknown) => {
        hist.commit(history.discard(hist.ref.current, step));
        onError(`Couldn't ${verb} ${step.label}: ${e instanceof Error ? e.message : String(e)}`);
      })
      .finally(() => {
        busy.current = false;
      });
  }, [hist, onError]);
  return { busy, run };
}

export function useUndo({ session, sendPatch, previewing, onError }: UndoDeps) {
  const hist = useLatest<History>(history.emptyHistory);
  const { busy, run: runFile } = useRunFile(hist, onError);
  const snapshot = useCallback(() => history.takeSnapshot(session.ref.current), [session.ref]);
  const add = useCallback((step: history.Step) => hist.commit(history.record(hist.ref.current, step)), [hist]);

  // Put a snapshot back, and the JV in line with it.
  const restore = useCallback((snap: history.Snapshot) => {
    const back = history.restoreSnapshot(session.ref.current, snap);
    session.commit(back);
    const cur = currentPatch(back);
    if (cur) sendPatch(cur);
  }, [sendPatch, session]);

  // `mergeKey`: a parameter's edits in quick succession, or everything one pointer gesture does, are one step.
  const remember = useCallback((label: string, mergeKey?: string) =>
    add(history.sessionStep(label, snapshot(), mergeKey === undefined ? undefined : mergeFor(mergeKey))), [add, snapshot]);
  const rememberFile = useCallback((label: string, action: history.FileAction) => add(history.fileStep(label, action)), [add]);

  // Opening a set: its session steps no longer apply; library file steps still do.
  const forget = useCallback(() => hist.commit(history.keepFileSteps(hist.ref.current)), [hist]);

  const travel = useCallback((go: typeof history.undo, verb: "undo" | "redo") => {
    const r = previewing.current || busy.current ? null : go(hist.ref.current, snapshot());
    if (!r) return;
    hist.commit(r.history);
    if (r.change.kind === "session") restore(r.change.before);
    else runFile(r.change.action[verb], r.moved, verb);
  }, [busy, hist, previewing, restore, runFile, snapshot]);

  return {
    remember,
    rememberFile,
    forget,
    undo: useCallback(() => travel(history.undo, "undo"), [travel]),
    redo: useCallback(() => travel(history.redo, "redo"), [travel]),
    undoLabel: history.undoLabel(hist.state),
    redoLabel: history.redoLabel(hist.state),
  };
}

export type Undo = ReturnType<typeof useUndo>;
