// The editor's session: the patch being edited (a slot of the open set, or the unslotted buffer), kept in step with
// the JV's temporary patch, with undo. Edits update the patch and go to the JV as DT1s (coalesced per address, so a
// drag sends at most one per frame); DT1s from the JV (eg. an edit on its panel) update the patch. The whole patch
// can be read from the JV or sent to it. The state rules are plain functions in sessionState.ts; what goes to the
// JV is in useJvSender.ts; slot and set actions are in useSetEdits.ts.

import { useCallback, useEffect, useRef, useState } from "react";
import { programChange, type Bank } from "../core/banks";
import {
  applyDt1, bufferToPatch, emptyPatch, nameBytes, PATCH_BLOCKS, patchName, paramDt1, setParam, setPatchName, type Patch,
} from "../core/patch";
import type { ParamDef } from "../core/params";
import { dt1, parseDt1 } from "../core/sysex";
import { readPatch } from "../link/readPatch";
import type { JvLink } from "../link/useJvLink";
import { demoPatch } from "./demoPatch";
import * as rules from "./sessionState";
import type { SessionState } from "./sessionState";
import { useJvSender, type JvSender } from "./useJvSender";
import { persistSession, restoreSession } from "./sessionPersist";
import { useLatest, type Latest } from "./useLatest";
import { useSetEdits, type SessionCore } from "./useSetEdits";
import { useUndo } from "./useUndo";

type Store = Latest<SessionState>;

// DT1s that arrive outside a read update the patch (not an undo step: the JV's panel isn't ours to take back). Not
// during an audition: the JV holds the auditioned patch then, and what it sends belongs to that, not to the patch
// being edited (which goes back to the JV on release).
function useIncomingEdits(link: JvLink, busy: boolean, { store, sender: { holds }, previewing }: SessionCore) {
  useEffect(() => link.subscribe((msg) => {
    const dt = busy || previewing.current ? undefined : parseDt1(msg);
    const cur = rules.currentPatch(store.ref.current);
    if (!dt?.checksumOk || !cur) return;
    const next = applyDt1(cur, dt.addr, dt.data);
    holds(next);
    store.commit(rules.replaceCurrent(store.ref.current, next));
  }), [link.subscribe, busy, store, holds, previewing]);
}

// Reading the whole patch from the JV, remembering whether the last read failed. Resolves to the patch, or
// undefined when the read didn't complete (or offline).
function useReadFromJv(link: JvLink, offline: boolean, setBusy: (b: boolean) => void) {
  const [readFailed, setReadFailed] = useState(false);
  const read = useCallback(async (): Promise<Patch | undefined> => {
    if (offline) return undefined;
    setBusy(true);
    const buffer = emptyPatch();
    const ok = await readPatch(link, buffer, () => {});
    const patch = ok ? bufferToPatch(buffer) : undefined;
    setReadFailed(!patch);
    link.note(patch ? `read "${patchName(patch)}"` : "read incomplete");
    setBusy(false);
    return patch;
  }, [link, offline, setBusy]);
  return { read, readFailed };
}

// Edits to the active patch: each is an undo step (merged while a drag or a run of CCs goes on) and a DT1.
function usePatchEdits({ store, sender, undo, previewing }: SessionCore, device: number) {
  const { remember } = undo;
  const { sendEdit } = sender;
  const edit = useCallback((fn: (p: Patch) => Patch, key: string, msg: number[], label: string) => {
    const result = previewing.current ? null : rules.editCurrent(store.ref.current, fn); // auditioning: read only
    if (!result) return;
    remember(label, key);
    store.commit(result.session);
    sendEdit(result.patch, key, msg);
  }, [previewing, remember, sendEdit, store]);

  const setValue = useCallback((p: ParamDef, value: number, tone = 0) => {
    const label = p.block === "tone" ? `${p.name} (tone ${tone + 1})` : p.name;
    edit((cur) => setParam(cur, p, value, tone), `${p.id}/${tone}`, paramDt1(p, value, tone, device), label);
  }, [edit, device]);

  // The name's 12 bytes go as one DT1 at the start of Patch Common.
  const setName = useCallback((name: string) =>
    edit((cur) => setPatchName(cur, name), "name", dt1(PATCH_BLOCKS[0]!.addr, nameBytes(name), device), "Rename patch"),
  [edit, device]);

  return { setValue, setName };
}

// Reads and writes of the whole patch: SYNC FROM / TO JV, the bank browser, and the quiet re-read after a change the
// JV may answer with values of its own.
function useSync(link: JvLink, { store, sender, undo }: SessionCore, read: () => Promise<Patch | undefined>) {
  const { holds, sendWhole, send } = sender;
  const { remember } = undo;
  const loadRead = useCallback(async (label: string) => {
    const patch = await read();
    if (!patch) return;
    holds(patch);
    remember(label);
    store.commit(rules.loadBuffer(store.ref.current, patch, null));
  }, [holds, read, remember, store]);

  const syncFromJv = useCallback(() => loadRead("Sync from JV"), [loadRead]);

  const resync = useCallback(async () => {
    const patch = await read();
    if (!patch) return;
    holds(patch);
    store.commit(rules.replaceCurrent(store.ref.current, patch));
  }, [holds, read, store]);

  const syncToJv = useCallback(async () => {
    const cur = rules.currentPatch(store.ref.current);
    if (cur) await sendWhole(cur);
  }, [sendWhole, store]);

  // The JV handles MIDI in order, so the read can follow the program change straight away.
  const loadFromBank = useCallback(async (bank: Bank, number: number) => {
    programChange(bank, number, link.channel).forEach((m, i) => send(m, ["bank MSB", "bank LSB", "program"][i]!));
    await loadRead(`Load ${bank.name} ${number}`);
  }, [link.channel, loadRead, send]);

  return { syncFromJv, resync, syncToJv, loadFromBank };
}

// The session survives quitting (sessionPersist.ts): saved shortly after each change, and on unload. Demo mode starts
// from its own patch and keeps nothing.
function usePersistedSession(offline: boolean): Store {
  const store = useLatest<SessionState>(() =>
    (offline ? rules.loadBuffer(rules.freshSession(), demoPatch(), null) : restoreSession()));
  const { state, ref } = store;
  useEffect(() => {
    if (offline) return;
    const t = setTimeout(() => persistSession(state), 400);
    return () => clearTimeout(t);
  }, [state, offline]);
  useEffect(() => {
    if (offline) return;
    const flush = () => persistSession(ref.current); // quitting inside the debounce must not lose the last edits
    window.addEventListener("beforeunload", flush);
    return () => window.removeEventListener("beforeunload", flush);
  }, [ref, offline]);
  return store;
}

// In demo mode nothing is sent: the editor works on its own patch without touching a JV.
export function useJvSession(link: JvLink, { demo, onError }: { demo: boolean; onError: (msg: string) => void }) {
  const offline = demo;
  const store = usePersistedSession(offline);
  const [busy, setBusy] = useState(false);
  const previewing = useRef(false);
  const sender = useJvSender(link, offline);
  const undo = useUndo({ session: store, sendPatch: sender.sendPatch, previewing, onError });
  const { read, readFailed } = useReadFromJv(link, offline, setBusy);
  const core: SessionCore = { store, sender, undo, previewing };
  useIncomingEdits(link, busy, core);
  const edits = usePatchEdits(core, link.device);
  const sync = useSync(link, core, read);
  const setEdits = useSetEdits(core);
  const { state } = store;
  const patchNow = useCallback(() => rules.currentPatch(store.ref.current), [store.ref]);

  return {
    state,
    patch: setEdits.shown?.patch ?? rules.currentPatch(state), // what the editor shows
    activePatch: rules.currentPatch(state), // the slot's or buffer's patch, whatever is being auditioned
    patchNow, // the active patch as it is this moment, ahead of the next render
    currentName: rules.currentName(state),
    busy,
    readFailed, // the last read from the JV didn't complete
    sendParam: sender.sendParam, // to the JV only, the patch unchanged (eg. solo)
    undo: undo.undo,
    redo: undo.redo,
    undoLabel: undo.undoLabel, // the step undo would take back; null = nothing to undo
    redoLabel: undo.redoLabel,
    rememberFile: undo.rememberFile, // a library file step, once done
    ...edits,
    ...sync,
    ...setEdits,
  };
}

export type JvSession = ReturnType<typeof useJvSession>;
