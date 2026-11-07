// Patch files and sets. A .syx patch is the 11 DT1 blocks back to back. A set (.tb3set) is JSON
// holding 16 self-contained slots: a name and the same 11-block dump as hex, so a slot
// round-trips byte for byte and never refers back to library files.
import { splitSysex } from "@synth-editors/midi";
import { patchFromSysex, patchToSysex } from "./patch";
import type { Patch } from "./patch";

export const SLOT_COUNT = 16;
export const SET_EXT = ".tb3set";
export const PATCH_EXT = ".syx";

export interface Slot {
  name: string;
  patch: Patch;
}

export type Slots = readonly (Slot | null)[];

export const emptySlots = (): Slots => Array<Slot | null>(SLOT_COUNT).fill(null);

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
    version: 1,
    slots: slots.map((s) => s && { name: s.name, blocks: patchToHex(s.patch) }),
  };
  return JSON.stringify(body, null, 2) + "\n";
}

export function setFromJson(text: string): Slots {
  const j = JSON.parse(text) as { format?: unknown; version?: unknown; slots?: unknown };
  if (j?.format !== "tb3set") throw new Error("not a TB-3 set file");
  if (j.version !== 1) throw new Error(`unsupported set version ${String(j.version)}`);
  if (!Array.isArray(j.slots) || j.slots.length !== SLOT_COUNT) throw new Error(`a set needs ${SLOT_COUNT} slots`);
  return j.slots.map((s: { name?: unknown; blocks?: unknown } | null, i) =>
    s === null ? null : { name: String(s.name ?? `Slot ${i + 1}`), patch: patchFromHex(String(s.blocks ?? "")) },
  );
}

// A slot's content as one comparable string: tells whether it differs from the saved set.
export const slotKey = (s: Slot | null): string => (s ? `${s.name}\n${patchToHex(s.patch)}` : "");

// "Bass/Acid 1.syx" → "Acid 1"
export const nameFromPath = (path: string): string => (path.split("/").pop() ?? path).replace(/\.[^.]*$/, "");
