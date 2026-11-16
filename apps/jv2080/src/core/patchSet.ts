// Patch files and sets, after apps/tb3/src/core/patchSet.ts. A .syx patch is the 9 DT1s to the temporary patch
// (core/patch encodeSyx). A set (.jvset) is JSON holding 16 self-contained slots: a name and the patch's 5 blocks as
// hex, so a slot round-trips byte for byte and never refers back to library files.
import { COMMON_SIZE, decodeSyx, encodeSyx, PATCH_BLOCKS, TONE_SIZE, type Patch } from "./patch";

export const SLOT_COUNT = 16;
export const SLOTS_PER_ROW = 8;
export const SET_EXT = ".jvset";
export const PATCH_EXT = ".syx";

export interface Slot {
  name: string;
  patch: Patch;
}

export type Slots = readonly (Slot | null)[];

export const emptySlots = (): Slots => Array<Slot | null>(SLOT_COUNT).fill(null);

const PATCH_BYTES = COMMON_SIZE + 4 * TONE_SIZE;

export const patchToBytes = (p: Patch): Uint8Array => encodeSyx(p);

// A patch from a .syx file; throws with a reason when the file isn't a whole JV patch.
export function patchFromBytes(bytes: ArrayLike<number>): Patch {
  const r = decodeSyx(bytes);
  if ("error" in r) throw new Error({ "no-patch": "no JV-2080 patch in the file", incomplete: "the patch is incomplete", checksum: "a checksum is wrong" }[r.error]);
  return r.patch;
}

const toHex = (bytes: readonly number[]) => bytes.map((b) => b.toString(16).padStart(2, "0")).join("");

export const patchToHex = (p: Patch): string => toHex(p.flat());

export function patchFromHex(hex: string): Patch {
  if (!/^(?:[0-9a-f]{2})*$/i.test(hex) || hex.length !== PATCH_BYTES * 2) throw new Error("patch data is not a JV patch");
  const bytes = (hex.match(/../g) ?? []).map((h) => parseInt(h, 16));
  let at = 0;
  return PATCH_BLOCKS.map((b) => {
    const block = bytes.slice(at, at + b.size);
    at += b.size;
    return block;
  });
}

export function setToJson(slots: Slots): string {
  const body = { format: "jvset", version: 1, slots: slots.map((s) => s && { name: s.name, blocks: patchToHex(s.patch) }) };
  return JSON.stringify(body, null, 2) + "\n";
}

interface SetJson {
  format?: unknown;
  version?: unknown;
  slots?: unknown;
}

// Throws unless `j` is a JV set this version can open.
function checkSet(j: SetJson): asserts j is { slots: ({ name?: unknown; blocks?: unknown } | null)[] } {
  if (j?.format !== "jvset") throw new Error("not a JV-2080 set file");
  if (j.version !== 1) throw new Error(`unsupported set version ${String(j.version)}`);
  if (!Array.isArray(j.slots) || j.slots.length !== SLOT_COUNT) throw new Error(`a set needs ${SLOT_COUNT} slots`);
}

export function setFromJson(text: string): Slots {
  const j = JSON.parse(text) as SetJson;
  checkSet(j);
  return j.slots.map((s, i) =>
    s === null ? null : { name: String(s.name ?? `Slot ${i + 1}`), patch: patchFromHex(String(s.blocks ?? "")) });
}

// A slot's content as one comparable string: tells whether it differs from the saved set.
export const slotKey = (s: Slot | null): string => (s ? `${s.name}\n${patchToHex(s.patch)}` : "");

// The slot a key was made from (null for an empty slot's key).
export function slotFromKey(key: string): Slot | null {
  const nl = key.lastIndexOf("\n");
  return nl < 0 ? null : { name: key.slice(0, nl), patch: patchFromHex(key.slice(nl + 1)) };
}

// "Pads/Warm 1.syx" → "Warm 1"
export const nameFromPath = (path: string): string => (path.split("/").pop() ?? path).replace(/\.[^.]*$/, "");
