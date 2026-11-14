// The session's state rules as plain functions: what STORE, DELETE, Replace, recall, opening a
// set, morph and CLEAR do to the open set, the active patch and the morph. `useSession` wires these
// to React and the TB-3; the undo history snapshots and restores exactly this state.
import { morph } from "../core/patch";
import type { Patch } from "../core/patch";
import { SLOT_COUNT, emptySlots, slotFromKey, slotKey } from "../core/patchSet";
import type { Slot, Slots } from "../core/patchSet";

export interface SessionState {
  setPath: string | null; // library-relative path of the open set; null = never saved
  slots: Slots;
  savedKeys: readonly string[]; // slotKey of each slot as last opened or saved
  active: number | null; // null = the unslotted buffer
  buffer: Patch | null;
  bufferName: string | null; // file the buffer was loaded from, if any
}

export const freshSession = (): SessionState => ({
  setPath: null,
  slots: emptySlots(),
  savedKeys: Array<string>(SLOT_COUNT).fill(""),
  active: null,
  buffer: null,
  bufferName: null,
});

export const currentPatch = (s: SessionState): Patch | null =>
  s.active === null ? s.buffer : (s.slots[s.active]?.patch ?? null);

export const currentName = (s: SessionState): string | null =>
  s.active === null ? s.bufferName : (s.slots[s.active]?.name ?? null);

const withSlot = (slots: Slots, i: number, slot: Slot | null): Slots => slots.map((s, j) => (j === i ? slot : s));

// Put `p` where the active patch lives: the active slot, or the buffer.
export function replaceCurrent(s: SessionState, p: Patch): SessionState {
  const slot = s.active === null ? null : s.slots[s.active];
  if (!slot) return { ...s, buffer: p };
  return { ...s, slots: withSlot(s.slots, s.active!, { ...slot, patch: p }) };
}

// Apply an edit to the active patch. Null when there is nothing to edit.
export function editCurrent(
  s: SessionState,
  fn: (p: Patch) => Patch,
): { session: SessionState; before: Patch; patch: Patch } | null {
  const before = currentPatch(s);
  if (!before) return null;
  const patch = fn(before);
  return { session: replaceCurrent(s, patch), before, patch };
}

// Make slot `i` the active patch. Null for an empty slot.
export const recallSlot = (s: SessionState, i: number): SessionState | null => (s.slots[i] ? { ...s, active: i } : null);

// Load a patch into the unslotted buffer (a file, or a sync from the TB-3).
export const loadBuffer = (s: SessionState, p: Patch, name: string | null): SessionState => ({
  ...s,
  active: null,
  buffer: p,
  bufferName: name,
});

// STORE: the active patch goes into slot `i`, which becomes active. Null when there is no patch.
export function storeSlot(s: SessionState, i: number): SessionState | null {
  const cur = currentPatch(s);
  if (!cur) return null;
  const name = currentName(s) ?? "Untitled";
  return { ...s, slots: withSlot(s.slots, i, { name, patch: cur }), active: i };
}

// Changing the active slot's contents leaves what it held in the buffer, so the editor keeps
// showing it.
function keepActiveInBuffer(s: SessionState, i: number): Partial<SessionState> {
  const slot = s.slots[i];
  return s.active === i && slot ? { active: null, buffer: slot.patch, bufferName: slot.name } : {};
}

// Replace (a library patch dropped on a slot), or DELETE when `slot` is null.
export const replaceSlot = (s: SessionState, i: number, slot: Slot | null): SessionState => ({
  ...s,
  ...keepActiveInBuffer(s, i),
  slots: withSlot(s.slots, i, slot),
});

export const deleteSlot = (s: SessionState, i: number): SessionState => replaceSlot(s, i, null);

// A slot dragged onto another.
export interface Move {
  from: number;
  to: number;
}

// Where slot index `x` ends up after a swap.
const swapIndex = (x: number | null, { from, to }: Move) => (x === from ? to : x === to ? from : x);

// The two slots swap (onto an empty slot, the patch moves). The active slot follows its patch. Null when there is
// nothing to move.
export function swapSlots(s: SessionState, move: Move): SessionState | null {
  if (move.from === move.to || !s.slots[move.from]) return null;
  const slots = s.slots.map((_, k) => s.slots[swapIndex(k, move)!] ?? null);
  return { ...s, slots, active: swapIndex(s.active, move) };
}

// Null when there is no slot to rename or the name is blank.
export function renameSlot(s: SessionState, i: number, name: string): SessionState | null {
  const slot = s.slots[i];
  const trimmed = name.trim();
  return slot && trimmed ? { ...s, slots: withSlot(s.slots, i, { ...slot, name: trimmed }) } : null;
}

// Opening a set (or a new one) keeps the editor on the patch it was showing, as the buffer.
export const openSet = (s: SessionState, path: string | null, slots: Slots): SessionState => ({
  ...freshSession(),
  setPath: path,
  slots,
  savedKeys: slots.map(slotKey),
  buffer: currentPatch(s),
  bufferName: currentName(s),
});

export const markSaved = (s: SessionState, path: string): SessionState => ({
  ...s,
  setPath: path,
  savedKeys: s.slots.map(slotKey),
});

// Which slots differ from the saved set, and whether anything does. `changed` includes slots
// emptied since (DELETE), which `modified` (the amber corner) leaves out.
export function saveStatus(s: SessionState): { modified: boolean[]; changed: boolean[]; dirty: boolean } {
  const changed = s.slots.map((slot, i) => slotKey(slot) !== s.savedKeys[i]);
  return { modified: changed.map((c, i) => c && s.slots[i] !== null), changed, dirty: changed.some(Boolean) };
}

// Revert to saved: slot `i`, or every slot, back to how the set was last opened or saved. The
// active slot stays active and shows its saved patch; if it was empty then, what it held moves to
// the buffer, as with DELETE. Null when there is nothing to revert.
export function revertSlot(s: SessionState, i: number): SessionState | null {
  if (slotKey(s.slots[i] ?? null) === s.savedKeys[i]) return null;
  const saved = slotFromKey(s.savedKeys[i] ?? "");
  return saved ? { ...s, slots: withSlot(s.slots, i, saved) } : replaceSlot(s, i, null);
}

export function revertSet(s: SessionState): SessionState | null {
  if (!saveStatus(s).dirty) return null;
  const slots = s.savedKeys.map(slotFromKey);
  const emptied = s.active !== null && !slots[s.active];
  return { ...s, ...(emptied ? keepActiveInBuffer(s, s.active!) : {}), slots };
}

// --- Morph -----------------------------------------------------------------------------------
// The base is the active patch when the fader first moves after choosing a target. Choosing
// another target, recalling or editing keeps the blend as the active patch and starts afresh.

export interface MorphState {
  target: number | null; // slot to morph towards
  amount: number; // 0-127
  base: Patch | null; // the active patch from before the morph; null = not started
}

export const noMorph: MorphState = { target: null, amount: 0, base: null };

export const restartMorph = (m: MorphState): MorphState => ({ ...m, amount: 0, base: null });

export const chooseMorphTarget = (i: number): MorphState => ({ target: i, amount: 0, base: null });

// Deleting the target slot drops it as the target.
export const morphAfterDelete = (m: MorphState, i: number): MorphState => (m.target === i ? { ...m, target: null } : m);

// After a swap the target follows its patch.
// ⌘-drag: slot `from` is copied over slot `to` (Replace, so an active target's patch stays in the editor).
export function copySlot(s: SessionState, { from, to }: Move): SessionState | null {
  const slot = s.slots[from];
  return slot && from !== to ? replaceSlot(s, to, slot) : null;
}

// The undo step's name: a swap, or a move onto an empty slot.
export const swapLabel = (s: SessionState, { from, to }: Move): string =>
  s.slots[to] ? `Swap slots ${from + 1} and ${to + 1}` : `Move slot ${from + 1} to ${to + 1}`;

export const morphAfterSwap = (m: MorphState, move: Move): MorphState => ({ ...m, target: swapIndex(m.target, move) });

// After a revert: a target slot left empty is dropped as the target.
export const morphAfterRevert = (m: MorphState, slots: Slots): MorphState =>
  m.target !== null && !slots[m.target] ? { ...m, target: null } : m;

// Move the fader to `amount`: the active patch becomes the blend. Null without a target or patch.
export function morphStep(
  s: SessionState,
  m: MorphState,
  amount: number,
): { session: SessionState; morph: MorphState } | null {
  const target = m.target === null ? null : s.slots[m.target];
  const cur = currentPatch(s);
  if (!target || !cur) return null;
  const base = m.base ?? cur;
  return {
    session: replaceCurrent(s, morph(base, target.patch, amount / 127)),
    morph: { ...m, amount, base },
  };
}

// CLEAR: drop the target and go back to the patch from before the morph. `reverted` is that patch,
// or null if the fader never moved.
export function clearMorph(s: SessionState, m: MorphState): { session: SessionState; reverted: Patch | null } {
  return m.base ? { session: replaceCurrent(s, m.base), reverted: m.base } : { session: s, reverted: null };
}
