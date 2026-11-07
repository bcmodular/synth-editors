// Patch session: the open set's 16 slots, the active patch (a slot, or the unslotted buffer),
// what the TB-3 currently holds, preview/grab, STORE and morph. See docs/tb3-phase3-design.md.
//
// The TB-3's state is tracked in `sent`: every recall, preview and morph sends only the blocks
// that differ from it. Edits send single params through the edit queue, but first bring the
// TB-3 in line if it doesn't hold the edited patch yet (after startup or a preview).
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { blocksToSysex, diffBlocks, morph, patchToSysex } from "../core/patch";
import type { Patch } from "../core/patch";
import { SLOT_COUNT, emptySlots, patchFromHex, patchToHex, slotKey } from "../core/patchSet";
import type { Slot, Slots } from "../core/patchSet";
import { createEditQueue } from "./editQueue";

export interface SessionState {
  setPath: string | null; // library-relative path of the open set; null = never saved
  slots: Slots;
  savedKeys: readonly string[]; // slotKey of each slot as last opened or saved
  active: number | null; // null = the unslotted buffer
  buffer: Patch | null;
  unsent: readonly boolean[]; // not sent to the TB-3 since the set was opened
}

export type SlotMode = "store" | "target" | null;

const STORAGE_KEY = "tb3.session";
const MORPH_SEND_MS = 40; // DIN MIDI is ~3 KB/s: a whole patch is ~430 bytes

const fresh = (): SessionState => ({
  setPath: null,
  slots: emptySlots(),
  savedKeys: Array<string>(SLOT_COUNT).fill(""),
  active: null,
  buffer: null,
  unsent: Array<boolean>(SLOT_COUNT).fill(true),
});

export const currentPatch = (s: SessionState): Patch | null =>
  s.active === null ? s.buffer : (s.slots[s.active]?.patch ?? null);

const withSlot = (slots: Slots, i: number, slot: Slot | null): Slots => slots.map((s, j) => (j === i ? slot : s));
const withFlag = (flags: readonly boolean[], i: number, v: boolean) => flags.map((f, j) => (j === i ? v : f));

// --- Persistence: the whole session, unsaved edits included, survives quitting. --------------

interface Stored {
  setPath: string | null;
  slots: ({ name: string; hex: string } | null)[];
  savedKeys: string[];
  active: number | null;
  buffer: string | null;
}

function restore(): SessionState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return fresh();
    const s = JSON.parse(raw) as Stored;
    return {
      ...fresh(),
      setPath: s.setPath,
      slots: s.slots.map((x) => x && { name: x.name, patch: patchFromHex(x.hex) }),
      savedKeys: s.savedKeys,
      active: s.active,
      buffer: s.buffer ? patchFromHex(s.buffer) : null,
    };
  } catch {
    return fresh(); // unreadable recovery data: start clean rather than fail to open
  }
}

function persist(s: SessionState) {
  const stored: Stored = {
    setPath: s.setPath,
    slots: s.slots.map((x) => x && { name: x.name, hex: patchToHex(x.patch) }),
    savedKeys: [...s.savedKeys],
    active: s.active,
    buffer: s.buffer ? patchToHex(s.buffer) : null,
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
  } catch {
    // Recovery is best effort.
  }
}

// --- Hook ------------------------------------------------------------------------------------

export function useSession(sendTb3: (msg: number[]) => void) {
  const [state, setState] = useState<SessionState>(restore);
  const ref = useRef(state);
  const commit = useCallback((next: SessionState) => {
    ref.current = next;
    setState(next);
  }, []);

  const queue = useMemo(() => createEditQueue(sendTb3), [sendTb3]);
  const sent = useRef<Patch | null>(null); // what the TB-3 holds; null = unknown
  const previewing = useRef(false);
  const [previewKey, setPreviewKey] = useState<string | null>(null);
  const [mode, setMode] = useState<SlotMode>(null);
  const [morphTarget, setMorphTarget] = useState<number | null>(null);
  const [morphAmount, setMorphAmount] = useState(0);
  const morphBase = useRef<Patch | null>(null);
  const morphTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Bring the TB-3 in line with `target`, sending only the blocks that differ.
  const sendPatch = useCallback(
    (target: Patch) => {
      queue.flush();
      const keys = sent.current ? diffBlocks(sent.current, target) : null;
      (keys ? blocksToSysex(target, keys) : patchToSysex(target)).forEach(sendTb3);
      sent.current = target;
    },
    [queue, sendTb3],
  );

  const markSent = (s: SessionState): SessionState =>
    s.active === null || !s.unsent[s.active] ? s : { ...s, unsent: withFlag(s.unsent, s.active, false) };

  const replaceCurrent = (s: SessionState, p: Patch): SessionState =>
    s.active === null
      ? { ...s, buffer: p }
      : { ...s, slots: withSlot(s.slots, s.active, { ...s.slots[s.active]!, patch: p }) };

  const resetMorph = () => {
    morphBase.current = null;
    setMorphAmount(0);
  };

  // Apply an edit to the active patch; `msg` is its DT1, coalesced by `key` in the edit queue.
  const edit = useCallback(
    (fn: (p: Patch) => Patch, key: string, msg: number[]) => {
      const s = ref.current;
      const cur = currentPatch(s);
      if (!cur) return;
      if (sent.current !== cur && !previewing.current) sendPatch(cur);
      const next = fn(cur);
      if (!previewing.current) sent.current = next;
      commit(markSent(replaceCurrent(s, next)));
      if (!previewing.current) queue.push(key, msg);
      if (morphBase.current) resetMorph(); // editing turns the blend into the active patch's edits
    },
    [commit, queue, sendPatch],
  );

  const recall = useCallback(
    (i: number) => {
      const s = ref.current;
      const slot = s.slots[i];
      if (!slot) return;
      commit(markSent({ ...s, active: i }));
      sendPatch(slot.patch);
      resetMorph();
    },
    [commit, sendPatch],
  );

  // Hold-to-audition (browser preview button, Option + slot): the editor keeps showing the
  // active patch; release sends it back.
  const preview = useCallback(
    (p: Patch, key: string) => {
      previewing.current = true;
      setPreviewKey(key);
      sendPatch(p);
    },
    [sendPatch],
  );

  const endPreview = useCallback(() => {
    if (!previewing.current) return;
    previewing.current = false;
    setPreviewKey(null);
    const cur = currentPatch(ref.current);
    if (!cur) return;
    sendPatch(cur);
    commit(markSent(ref.current));
  }, [commit, sendPatch]);

  // Sync from TB-3: the TB-3's patch becomes the unslotted buffer.
  const fromTb3 = useCallback(
    (p: Patch) => {
      sent.current = p;
      commit({ ...ref.current, active: null, buffer: p });
      resetMorph();
    },
    [commit],
  );

  const sendAll = useCallback(() => {
    const cur = currentPatch(ref.current);
    if (!cur) return;
    sent.current = null; // force every block
    sendPatch(cur);
    commit(markSent(ref.current));
  }, [commit, sendPatch]);

  const store = useCallback(
    (i: number) => {
      const s = ref.current;
      const cur = currentPatch(s);
      if (!cur) return;
      const name = s.active !== null ? s.slots[s.active]!.name : "Untitled";
      commit({
        ...s,
        slots: withSlot(s.slots, i, { name, patch: cur }),
        active: i,
        unsent: withFlag(s.unsent, i, sent.current !== cur),
      });
    },
    [commit],
  );

  const loadIntoSlot = useCallback(
    (i: number, slot: Slot) => {
      const s = ref.current;
      // Replacing the active slot leaves what it held in the buffer, so the editor keeps showing it.
      const keep = s.active === i ? { active: null, buffer: s.slots[i]!.patch } : {};
      commit({ ...s, ...keep, slots: withSlot(s.slots, i, slot), unsent: withFlag(s.unsent, i, true) });
    },
    [commit],
  );

  const clear = useCallback(
    (i: number) => {
      const s = ref.current;
      const keep = s.active === i ? { active: null, buffer: s.slots[i]!.patch } : {};
      commit({ ...s, ...keep, slots: withSlot(s.slots, i, null) });
      if (morphTarget === i) setMorphTarget(null);
    },
    [commit, morphTarget],
  );

  const rename = useCallback(
    (i: number, name: string) => {
      const s = ref.current;
      const slot = s.slots[i];
      if (slot && name.trim()) commit({ ...s, slots: withSlot(s.slots, i, { ...slot, name: name.trim() }) });
    },
    [commit],
  );

  // Opening a set (or a new one) keeps the editor on the patch it was showing, as the buffer.
  const openSet = useCallback(
    (path: string | null, slots: Slots) => {
      const s = ref.current;
      commit({
        ...fresh(),
        setPath: path,
        slots,
        savedKeys: slots.map(slotKey),
        buffer: currentPatch(s),
      });
      setMorphTarget(null);
      resetMorph();
    },
    [commit],
  );

  const markSaved = useCallback(
    (path: string) => commit({ ...ref.current, setPath: path, savedKeys: ref.current.slots.map(slotKey) }),
    [commit],
  );

  // Morph: the base is the active patch when the fader first moves after choosing a target.
  const chooseMorphTarget = useCallback((i: number) => {
    setMorphTarget(i);
    resetMorph();
  }, []);

  const setMorph = useCallback(
    (amount: number) => {
      const s = ref.current;
      const target = morphTarget === null ? null : s.slots[morphTarget];
      const cur = currentPatch(s);
      if (!target || !cur) return;
      morphBase.current ??= cur;
      setMorphAmount(amount);
      commit(replaceCurrent(s, morph(morphBase.current, target.patch, amount / 127)));
      if (morphTimer.current === undefined) {
        morphTimer.current = setTimeout(() => {
          morphTimer.current = undefined;
          const now = currentPatch(ref.current);
          if (now && !previewing.current) sendPatch(now);
        }, MORPH_SEND_MS);
      }
    },
    [commit, morphTarget, sendPatch],
  );

  useEffect(() => {
    const t = setTimeout(() => persist(state), 400);
    return () => clearTimeout(t);
  }, [state]);

  // Quitting or reloading inside the debounce window must not lose the last edits.
  useEffect(() => {
    const flush = () => persist(ref.current);
    window.addEventListener("beforeunload", flush);
    return () => {
      window.removeEventListener("beforeunload", flush);
      clearTimeout(morphTimer.current);
    };
  }, []);

  const keys = useMemo(() => state.slots.map(slotKey), [state.slots]);
  const modified = keys.map((k, i) => state.slots[i] !== null && k !== state.savedKeys[i]);
  const dirty = keys.some((k, i) => k !== state.savedKeys[i]);

  return {
    state,
    patch: currentPatch(state),
    modified,
    dirty,
    previewKey,
    mode,
    setMode,
    morphTarget,
    morphAmount,
    push: queue.push, // sends outside the patch (global tuning), coalesced like edits
    edit,
    recall,
    preview,
    endPreview,
    fromTb3,
    sendAll,
    store,
    loadIntoSlot,
    clear,
    rename,
    openSet,
    markSaved,
    chooseMorphTarget,
    setMorph,
  };
}

export type Session = ReturnType<typeof useSession>;
