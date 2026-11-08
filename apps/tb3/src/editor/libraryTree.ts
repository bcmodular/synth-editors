// Pure helpers for the library browser: search, hover text, moves and renames.
import { nameFromPath } from "../core/patchSet";
import { joinPath, parentOf } from "./useLibrary";
import type { LibEntry } from "./useLibrary";

const when = (ms: number | undefined) =>
  ms ? new Date(ms).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "–";

// Hover text: the path, and for files when they were created and last changed.
export const entryTip = (e: LibEntry): string =>
  [
    e.path,
    e.error && `Not a TB-3 patch: ${e.error}`,
    e.kind !== "dir" && `Created ${when(e.created)}\nModified ${when(e.modified)}`,
  ]
    .filter(Boolean)
    .join("\n");

// Entries whose name matches `q` (lower case), plus the folders leading to them.
export function filterTree(entries: LibEntry[], q: string): LibEntry[] {
  const out: LibEntry[] = [];
  for (const e of entries) {
    const kids = e.children ? filterTree(e.children, q) : [];
    if (kids.length || e.name.toLowerCase().includes(q)) out.push(e.children ? { ...e, children: kids } : e);
  }
  return out;
}

export interface Move {
  from: string; // library path of what moves
  into: string; // folder it moves into
}

// Where a move puts the entry; null when that is no move (already there, or into itself).
export function moveTarget({ from, into }: Move): string | null {
  const intoItself = into === from || into.startsWith(`${from}/`);
  if (intoItself || parentOf(from) === into) return null;
  return joinPath(into, from.split("/").pop()!);
}

// The name shown and edited: files without their extension.
export const displayName = (e: LibEntry): string => (e.kind === "dir" ? e.name : nameFromPath(e.name));

// Renaming keeps a file's extension whether or not the new name repeats it.
export function renameTarget(e: LibEntry, name: string): string {
  const ext = e.kind === "dir" ? "" : e.name.slice(e.name.lastIndexOf("."));
  return joinPath(parentOf(e.path), name.endsWith(ext) ? name : name + ext);
}
