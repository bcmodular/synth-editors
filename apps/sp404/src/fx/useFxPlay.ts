// Playing the FX library (docs/sp404-design.md › FX): the STORE and DEL modes, LOCK and GRAB per bus, morph per bus,
// and what pressing a preset, DEF or a scene does in each. Holding a stored preset or scene with GRAB on (or Shift
// held) previews it, and letting go puts back what was there.

import { useCallback, useRef, useState } from "react";
import type { Bus } from "../core/fxTypes";
import {
  clearBus, deletePresetAt, deleteSceneAt, recallDefaults, recallPresetAt, recallSceneAt, slotsOn, storeDefaultsOn,
  storePresetAt, storeSceneAt, type Locks, type SlotRef,
} from "./fxLibrary";
import { applyMorph, morphTarget, startMorph, type BusMorph } from "./fxMorph";
import type { Buses } from "../core/fxModel";
import type { FxState } from "./fxState";
import type { Change, FxStore } from "./useFxStore";

// STORE: a press stores (over a stored slot too, and DEF stores defaults). DEL: a press deletes (a bus number
// clears its bus). Both stay on until pressed again.
export type FxMode = "play" | "store" | "delete";

const LOCKS_KEY = "sp404.fxLocks";

function readLocks(): Set<Bus> {
  try {
    return new Set(JSON.parse(localStorage.getItem(LOCKS_KEY) ?? "[]") as Bus[]);
  } catch {
    return new Set();
  }
}

const toggled = <T>(set: ReadonlySet<T>, item: T): Set<T> => {
  const next = new Set(set);
  if (!next.delete(item)) next.add(item);
  return next;
};

type Morphs = Partial<Record<Bus, BusMorph>>;

// What a press on a preset slot does, given the mode and whether the slot is stored.
function presetChange(mode: FxMode, ref: SlotRef, locks: Locks): Change {
  if (mode === "delete") return (s) => deletePresetAt(s, ref, locks);
  if (mode === "store") return (s) => storePresetAt(s, ref, locks);
  return (s) => (slotsOn(s, ref.bus)[ref.slot] ? recallPresetAt(s, ref) : storePresetAt(s, ref, locks));
}

function sceneChange(mode: FxMode, slot: number, locks: Locks): Change {
  if (mode === "delete") return (s) => deleteSceneAt(s, slot);
  if (mode === "store") return (s) => storeSceneAt(s, slot);
  return (s) => (s.scenes[slot] ? recallSceneAt(s, slot, locks) : storeSceneAt(s, slot));
}

const withBuses = (buses: Buses): Change => (s: FxState) => ({ ...s, buses });

// GRAB: apply a change for as long as it's held, then put the buses back.
function usePreview(store: FxStore) {
  const before = useRef<Buses | null>(null);
  const hold = useCallback((change: Change) => {
    before.current ??= store.current.current.buses;
    store.apply(change);
  }, [store]);
  const release = useCallback(() => {
    if (before.current) store.apply(withBuses(before.current));
    before.current = null;
  }, [store]);
  return { hold, release };
}

function useMorphs(store: FxStore) {
  const [morphs, setMorphs] = useState<Morphs>({});
  const latest = useRef(morphs);
  const put = (next: Morphs) => {
    latest.current = next;
    setMorphs(next);
  };
  // EXP: morph on (no target yet) or off (keeping the blend).
  const toggleMorph = useCallback((bus: Bus) => {
    const { [bus]: was, ...rest } = latest.current;
    put(was ? rest : { ...rest, [bus]: startMorph(store.current.current, bus) });
  }, [store]);
  const target = useCallback((bus: Bus, slot: number) => {
    put({ ...latest.current, [bus]: morphTarget(store.current.current, bus, slot) });
  }, [store]);
  const amount = useCallback((bus: Bus, value: number) => {
    const m = latest.current[bus];
    if (!m) return;
    const next = { ...m, amount: value };
    put({ ...latest.current, [bus]: next });
    store.apply((s) => applyMorph(s, bus, next));
  }, [store]);
  const end = useCallback((bus: Bus) => {
    const { [bus]: _gone, ...rest } = latest.current;
    put(rest);
  }, []);
  return { morphs, toggleMorph, target, amount, end };
}

// The global STORE / DEL mode, and LOCK and GRAB per bus (locks are remembered between runs).
function useModes() {
  const [mode, setModeShown] = useState<FxMode>("play");
  const [locks, setLocks] = useState<Set<Bus>>(readLocks);
  const [grabs, setGrabs] = useState<Set<Bus>>(new Set());
  const setMode = useCallback((next: FxMode) => setModeShown((m) => (m === next ? "play" : next)), []);
  const toggleLock = useCallback((bus: Bus) => setLocks((l) => {
    const next = toggled(l, bus);
    localStorage.setItem(LOCKS_KEY, JSON.stringify([...next]));
    return next;
  }), []);
  const toggleGrab = useCallback((bus: Bus) => setGrabs((g) => toggled(g, bus)), []);
  return { mode, setMode, locks, toggleLock, grabs, toggleGrab };
}

type Modes = ReturnType<typeof useModes>;

// A held press previews only in play mode, and only something stored.
function previews(held: boolean, mode: FxMode, stored: unknown): boolean {
  if (mode !== "play") return false;
  return held && Boolean(stored);
}

const storedSlot = (store: FxStore, { bus, slot }: SlotRef) => slotsOn(store.current.current, bus)[slot];

type Preview = ReturnType<typeof usePreview>;
type MorphControls = ReturnType<typeof useMorphs>;

function usePresses(store: FxStore, { mode, locks }: Modes, preview: Preview, morph: MorphControls) {
  // A preset slot pressed: the morph target while morph is on; else by mode (held with GRAB or Shift: a preview).
  const pressPreset = useCallback((ref: SlotRef, held: boolean) => {
    const stored = storedSlot(store, ref);
    if (morph.morphs[ref.bus]) return void (stored && morph.target(ref.bus, ref.slot));
    if (previews(held, mode, stored)) return preview.hold((s) => recallPresetAt(s, ref));
    store.apply(presetChange(mode, ref, locks));
  }, [mode, locks, morph, preview, store]);

  const pressScene = useCallback((slot: number, held: boolean) => {
    if (previews(held, mode, store.current.current.scenes[slot])) return preview.hold((s) => recallSceneAt(s, slot, locks));
    store.apply(sceneChange(mode, slot, locks));
  }, [mode, locks, preview, store]);

  const pressDefaults = useCallback((bus: Bus) => {
    store.apply(mode === "store" ? (s) => storeDefaultsOn(s, bus, locks) : (s) => recallDefaults(s, bus));
  }, [mode, locks, store]);

  // A bus number in DEL mode clears the bus.
  const pressBus = useCallback((bus: Bus) => {
    if (mode !== "delete") return;
    morph.end(bus);
    store.apply((s) => clearBus(s, bus, locks));
  }, [mode, locks, morph, store]);

  return { pressPreset, pressScene, pressDefaults, pressBus };
}

export function useFxPlay(store: FxStore) {
  const modes = useModes();
  const preview = usePreview(store);
  const morph = useMorphs(store);
  const presses = usePresses(store, modes, preview, morph);
  return {
    ...modes, ...presses, morphs: morph.morphs, toggleMorph: morph.toggleMorph, setMorphAmount: morph.amount,
    endMorph: morph.end, release: preview.release,
  };
}

export type FxPlay = ReturnType<typeof useFxPlay>;
