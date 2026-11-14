// Patch files and sets. A .syx patch is the 11 DT1 blocks back to back. A set (.tb3set) is JSON
// holding 64 self-contained slots (8 rows of 8, as on the Launchpad): a name and the same 11-block dump as hex, so a slot
// round-trips byte for byte and never refers back to library files.
import { splitSysex } from "@synth-editors/midi";
import { patchFromSysex, patchToSysex } from "./patch";
import type { Patch } from "./patch";

export const SLOT_COUNT = 64;
export const SLOTS_PER_ROW = 8;
export const SET_EXT = ".tb3set";
export const PATCH_EXT = ".syx";

export interface Slot {
  name: string;
  patch: Patch;
}

export type Slots = readonly (Slot | null)[];

export const emptySlots = (): Slots => Array<Slot | null>(SLOT_COUNT).fill(null);

// Fill out to SLOT_COUNT with `empty` (sets and sessions from before 64 slots had 16).
export const padSlots = <T>(xs: readonly T[], empty: T): T[] => [...xs, ...Array<T>(Math.max(0, SLOT_COUNT - xs.length)).fill(empty)];

export const patchToBytes = (p: Patch): Uint8Array => Uint8Array.from(patchToSysex(p).flat());
export const patchFromBytes = (bytes: ArrayLike<number>): Patch => patchFromSysex(splitSysex(bytes));

const toHex = (bytes: ArrayLike<number>) => Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");

function fromHex(hex: string): Uint8Array {
  if (!/^(?:[0-9a-f]{2})*$/i.test(hex)) throw new Error("patch data is not hex");
  return Uint8Array.from(hex.match(/../g) ?? [], (h) => parseInt(h, 16));
}

export const patchToHex = (p: Patch): string => toHex(patchToBytes(p));
export const patchFromHex = (hex: string): Patch => patchFromBytes(fromHex(hex));

export function setToJson(slots: Slots): string {
  const body = {
    format: "tb3set",
    version: 2,
    slots: slots.map((s) => s && { name: s.name, blocks: patchToHex(s.patch) }),
  };
  return JSON.stringify(body, null, 2) + "\n";
}

export function setFromJson(text: string): Slots {
  const j = JSON.parse(text) as { format?: unknown; version?: unknown; slots?: unknown };
  if (j?.format !== "tb3set") throw new Error("not a TB-3 set file");
  // Version 1 had 16 slots; they open as the first two rows.
  const count = { 1: 16, 2: SLOT_COUNT }[String(j.version)];
  if (!count) throw new Error(`unsupported set version ${String(j.version)}`);
  if (!Array.isArray(j.slots) || j.slots.length !== count) throw new Error(`a set needs ${count} slots`);
  const slots = j.slots.map((s: { name?: unknown; blocks?: unknown } | null, i) =>
    s === null ? null : { name: String(s.name ?? `Slot ${i + 1}`), patch: patchFromHex(String(s.blocks ?? "")) },
  );
  return padSlots<Slot | null>(slots, null);
}

// A slot's content as one comparable string: tells whether it differs from the saved set.
export const slotKey = (s: Slot | null): string => (s ? `${s.name}\n${patchToHex(s.patch)}` : "");

// The slot a key was made from (null for an empty slot's key).
export function slotFromKey(key: string): Slot | null {
  const nl = key.lastIndexOf("\n");
  return nl < 0 ? null : { name: key.slice(0, nl), patch: patchFromHex(key.slice(nl + 1)) };
}

// "Bass/Acid 1.syx" → "Acid 1"
export const nameFromPath = (path: string): string => (path.split("/").pop() ?? path).replace(/\.[^.]*$/, "");
