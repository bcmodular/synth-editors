// Patch library: the remembered root folder and its tree, refreshed whenever files change
// (in the app or in Finder). Every .syx is parsed up front so invalid files can be flagged.
import { useCallback, useEffect, useState } from "react";
import type { Patch } from "../core/patch";
import { patchFromBytes } from "../core/patchSet";

const ROOT_KEY = "tb3.libraryRoot";

export interface LibEntry {
  kind: "dir" | "patch" | "set";
  name: string;
  path: string;
  children?: LibEntry[];
  patch?: Patch; // valid patches
  error?: string; // patches that don't parse
}

function parse(nodes: LibraryNode[]): LibEntry[] {
  return nodes.map((n) => {
    if (n.kind === "dir") return { kind: n.kind, name: n.name, path: n.path, children: parse(n.children ?? []) };
    if (n.kind === "set") return { kind: n.kind, name: n.name, path: n.path };
    try {
      return { kind: n.kind, name: n.name, path: n.path, patch: patchFromBytes(n.data ?? []) };
    } catch (e) {
      return { kind: n.kind, name: n.name, path: n.path, error: e instanceof Error ? e.message : String(e) };
    }
  });
}

export function useLibrary() {
  const files = window.tb3Files;
  const [root, setRoot] = useState<string | null>(null);
  const [tree, setTree] = useState<LibEntry[]>([]);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!files) return;
    try {
      setTree(parse(await files.list()));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [files]);

  const opened = useCallback(
    (dir: string) => {
      setRoot(dir);
      try {
        localStorage.setItem(ROOT_KEY, dir);
      } catch {
        // Remembering the folder is a convenience.
      }
      void refresh();
    },
    [refresh],
  );

  useEffect(() => {
    if (!files) return;
    let saved: string | null = null;
    try {
      saved = localStorage.getItem(ROOT_KEY);
    } catch {
      saved = null;
    }
    if (saved) files.open(saved).then(opened, (e: unknown) => setError(String(e instanceof Error ? e.message : e)));
    return files.onChanged(() => void refresh());
  }, [files, opened, refresh]);

  const choose = useCallback(async () => {
    const dir = await files?.choose();
    if (dir) opened(dir);
  }, [files, opened]);

  return { available: Boolean(files), root, tree, error, choose, refresh };
}

export type Library = ReturnType<typeof useLibrary>;

// Every entry in the tree, depth first.
export function* walk(entries: LibEntry[]): Generator<LibEntry> {
  for (const e of entries) {
    yield e;
    if (e.children) yield* walk(e.children);
  }
}

export const parentOf = (path: string): string => path.split("/").slice(0, -1).join("/");
export const joinPath = (dir: string, name: string): string => (dir ? `${dir}/${name}` : name);
