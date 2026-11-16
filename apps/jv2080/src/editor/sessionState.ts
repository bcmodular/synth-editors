// The session's state rules as plain functions, after apps/tb3/src/editor/sessionState.ts (without morph): what
// STORE, DELETE, Replace, recall and opening a set do to the open set and the active patch. `useJvSession` wires
// these to React and the JV; the undo history snapshots and restores exactly this state.
import { patchName, type Patch } from "../core/patch";
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

// Load a patch into the unslotted buffer (a file, a sync from the JV, a bank patch).
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
  const name = currentName(s) ?? patchName(cur);
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

// ⌘-drag: slot `from` is copied over slot `to` (Replace, so an active target's patch stays in the editor).
export function copySlot(s: SessionState, { from, to }: Move): SessionState | null {
  const slot = s.slots[from];
  return slot && from !== to ? replaceSlot(s, to, slot) : null;
}

// The undo step's name: a swap, or a move onto an empty slot.
export const swapLabel = (s: SessionState, { from, to }: Move): string =>
  s.slots[to] ? `Swap slots ${from + 1} and ${to + 1}` : `Move slot ${from + 1} to ${to + 1}`;

