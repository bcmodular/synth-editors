// Patch session: the open set's 16 slots, the active patch (a slot, or the unslotted buffer),
// what the TB-3 currently holds, preview/grab, STORE and morph. See docs/tb3-phase3-design.md.
//
// The TB-3's state is tracked in `sent`: every recall, preview and morph sends only the blocks
// that differ from it. Edits send single params through the edit queue, but first bring the
// TB-3 in line if it doesn't hold the edited patch yet (after startup or a preview).
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { applyRun, blocksToSysex, diffBlocks, morph, morphRuns, patchToSysex, runToSysex } from "../core/patch";
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
  bufferName: string | null; // file the buffer was loaded from, if any
}

// Slot click modes: delete clears, grab auditions while held, target picks the morph target.
export type SlotMode = "delete" | "grab" | "target" | null;

const STORAGE_KEY = "tb3.session";
const RATE_KEY = "tb3.morphRate";

// Morph sends are capped in changed bytes per second: a fast move between patches that differ a
// lot can otherwise flood the TB-3 until it stops playing. The editor follows the fader at once;
// the TB-3 catches up at the capped rate, latest values only.
export const MORPH_RATES = [10, 20, 30, 50, 75, 100, 150, 200, 300, 500] as const;
const DEFAULT_RATE = 100;
const PUMP_MS = 20;
const BURST_S = 0.2; // the bucket holds at most this many seconds of budget

function restoreRate(): number {
  const v = Number(localStorage.getItem(RATE_KEY));
  return (MORPH_RATES as readonly number[]).includes(v) ? v : DEFAULT_RATE;
}

const fresh = (): SessionState => ({
  setPath: null,
  slots: emptySlots(),
  savedKeys: Array<string>(SLOT_COUNT).fill(""),
  active: null,
  buffer: null,
  bufferName: null,
});

export const currentPatch = (s: SessionState): Patch | null =>
  s.active === null ? s.buffer : (s.slots[s.active]?.patch ?? null);

const withSlot = (slots: Slots, i: number, slot: Slot | null): Slots => slots.map((s, j) => (j === i ? slot : s));

// --- Persistence: the whole session, unsaved edits included, survives quitting. --------------

interface Stored {
  setPath: string | null;
  slots: ({ name: string; hex: string } | null)[];
  savedKeys: string[];
  active: number | null;
  buffer: string | null;
  bufferName?: string | null;
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
      bufferName: s.bufferName ?? null,
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
    bufferName: s.bufferName,
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
  const [previewing_, setPreviewing] = useState<{ key: string; name: string; patch: Patch } | null>(null);
  const [mode, setMode] = useState<SlotMode>(null);
  const [morphTarget, setMorphTarget] = useState<number | null>(null);
  const [morphAmount, setMorphAmount] = useState(0);
  const morphBase = useRef<Patch | null>(null);
  const [morphRate, setMorphRateState] = useState(restoreRate);
  const rate = useRef(morphRate);
  // Rate-limited morph sends: `pumpTarget` is the latest blend, sent in byte runs from a token
  // bucket. Rotating `cursor` keeps one busy block from starving the others.
  const pumpTarget = useRef<Patch | null>(null);
  const pump = useRef({ timer: undefined as ReturnType<typeof setInterval> | undefined, tokens: 0, last: 0, cursor: 0 });

  // Bring the TB-3 in line with `target`, sending only the blocks that differ.
  const sendPatch = useCallback(
    (target: Patch) => {
      queue.flush();
      pumpTarget.current = null; // a full send supersedes any morph catch-up
      const keys = sent.current ? diffBlocks(sent.current, target) : null;
      (keys ? blocksToSysex(target, keys) : patchToSysex(target)).forEach(sendTb3);
      sent.current = target;
    },
    [queue, sendTb3],
  );

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
      if (!cur || previewing.current) return; // the editor shows the auditioned patch: read only
      if (sent.current !== cur) sendPatch(cur);
      const next = fn(cur);
      sent.current = next;
      commit(replaceCurrent(s, next));
      queue.push(key, msg);
      if (morphBase.current) resetMorph(); // editing turns the blend into the active patch's edits
    },
    [commit, queue, sendPatch],
  );

  const recall = useCallback(
    (i: number) => {
      const s = ref.current;
      const slot = s.slots[i];
      if (!slot) return;
      commit({ ...s, active: i });
      sendPatch(slot.patch);
      resetMorph();
    },
    [commit, sendPatch],
  );

  // Load a patch file into the unslotted buffer (not into the set) and send it.
  const load = useCallback(
    (p: Patch, name: string) => {
      commit({ ...ref.current, active: null, buffer: p, bufferName: name });
      sendPatch(p);
      resetMorph();
    },
    [commit, sendPatch],
  );

  // Hold-to-audition (browser preview button, Option + slot): the editor shows the auditioned
  // patch, read only; release sends the active patch back.
  const preview = useCallback(
    (p: Patch, key: string, name: string) => {
      previewing.current = true;
      setPreviewing({ key, name, patch: p });
      sendPatch(p);
    },
    [sendPatch],
  );

  const endPreview = useCallback(() => {
    if (!previewing.current) return;
    previewing.current = false;
    setPreviewing(null);
    const cur = currentPatch(ref.current);
    if (!cur) return;
    sendPatch(cur);
  }, [sendPatch]);

  // Sync from TB-3: the TB-3's patch becomes the unslotted buffer.
  const fromTb3 = useCallback(
    (p: Patch) => {
      sent.current = p;
      commit({ ...ref.current, active: null, buffer: p, bufferName: null });
      resetMorph();
    },
    [commit],
  );

  const sendAll = useCallback(() => {
    const cur = currentPatch(ref.current);
    if (!cur) return;
    sent.current = null; // force every block
    sendPatch(cur);
  }, [sendPatch]);

  const store = useCallback(
    (i: number) => {
      const s = ref.current;
      const cur = currentPatch(s);
      if (!cur) return;
      const name = s.active !== null ? s.slots[s.active]!.name : (s.bufferName ?? "Untitled");
      commit({
        ...s,
        slots: withSlot(s.slots, i, { name, patch: cur }),
        active: i,
      });
    },
    [commit],
  );

  const loadIntoSlot = useCallback(
    (i: number, slot: Slot) => {
      const s = ref.current;
      // Replacing the active slot leaves what it held in the buffer, so the editor keeps showing it.
      const keep = s.active === i ? { active: null, buffer: s.slots[i]!.patch, bufferName: s.slots[i]!.name } : {};
      commit({ ...s, ...keep, slots: withSlot(s.slots, i, slot) });
    },
    [commit],
  );

  const clear = useCallback(
    (i: number) => {
      const s = ref.current;
      const keep = s.active === i ? { active: null, buffer: s.slots[i]!.patch, bufferName: s.slots[i]!.name } : {};
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
        bufferName: s.active === null ? s.bufferName : s.slots[s.active]!.name,
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

  const stopPump = useCallback(() => {
    clearInterval(pump.current.timer);
    pump.current.timer = undefined;
  }, []);

  const tick = useCallback(() => {
    const target = pumpTarget.current;
    const from = sent.current;
    if (!target || !from) {
      if (target) sendPatch(target); // TB-3 state unknown: one full send
      return stopPump();
    }
    const pm = pump.current;
    const now = performance.now();
    const cap = Math.max(1, rate.current * BURST_S);
    pm.tokens = Math.min(cap, pm.tokens + ((now - pm.last) / 1000) * rate.current);
    pm.last = now;
    const runs = morphRuns(from, target);
    if (!runs.length) {
      sent.current = target; // caught up: keep identity so edits don't resend
      pumpTarget.current = null;
      return stopPump();
    }
    // Whole blocks first, in order; then the byte runs, rotating.
    const whole = runs.filter((r) => r.whole);
    const parts = runs.filter((r) => !r.whole);
    const order = [...whole, ...parts.map((_, n) => parts[(pm.cursor + n) % parts.length]!)];
    let p = from;
    for (let n = 0; n < order.length; n++) {
      const run = order[n]!;
      // A run bigger than the whole bucket still goes once the bucket is full.
      if (pm.tokens < Math.min(run.data.length, cap)) {
        if (parts.length) pm.cursor = (pm.cursor + Math.max(0, n - whole.length)) % parts.length;
        break;
      }
      sendTb3(runToSysex(run));
      p = applyRun(p, run);
      pm.tokens -= run.data.length;
    }
    sent.current = p;
  }, [sendPatch, sendTb3, stopPump]);

  const startPump = useCallback(() => {
    const pm = pump.current;
    if (pm.timer !== undefined) return;
    queue.flush();
    pm.last = performance.now();
    tick(); // send what the bucket allows straight away
    if (pumpTarget.current) pm.timer = setInterval(tick, PUMP_MS);
  }, [queue, tick]);

  const setMorphRate = useCallback((r: number) => {
    rate.current = r;
    setMorphRateState(r);
    try {
      localStorage.setItem(RATE_KEY, String(r));
    } catch {
      // best effort
    }
  }, []);

  // Morph: the base is the active patch when the fader first moves after choosing a target.
  // Choosing another target, or none, keeps the blend in the editor as the active patch.
  const chooseMorphTarget = useCallback((i: number | null) => {
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
      if (!previewing.current) {
        pumpTarget.current = currentPatch(ref.current);
        startPump();
      }
    },
    [commit, morphTarget, startPump],
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
      clearInterval(pump.current.timer);
    };
  }, []);

  const keys = useMemo(() => state.slots.map(slotKey), [state.slots]);
  const modified = keys.map((k, i) => state.slots[i] !== null && k !== state.savedKeys[i]);
  const dirty = keys.some((k, i) => k !== state.savedKeys[i]);

  return {
    state,
    patch: previewing_?.patch ?? currentPatch(state), // what the editor shows
    activePatch: currentPatch(state),
    currentName: state.active === null ? state.bufferName : (state.slots[state.active]?.name ?? null),
    previewKey: previewing_?.key ?? null,
    previewName: previewing_?.name ?? null,
    modified,
    dirty,
    mode,
    setMode,
    morphTarget,
    morphAmount,
    morphRate,
    setMorphRate,
    push: queue.push, // sends outside the patch (global tuning), coalesced like edits
    edit,
    recall,
    load,
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
