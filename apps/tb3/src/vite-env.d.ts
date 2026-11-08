/// <reference types="vite/client" />

// Exposed by electron/preload.cjs; absent when the renderer runs in a plain browser.
interface LibraryNode {
  kind: "dir" | "patch" | "set";
  name: string; // file or folder name, with extension
  path: string; // relative to the library root, "/"-separated
  children?: LibraryNode[]; // folders
  data?: Uint8Array; // patches: the file's bytes
  created?: number; // files: birth and modification times, ms since the epoch
  modified?: number;
}

interface Window {
  tb3Files?: {
    choose(): Promise<string | null>; // folder picker; opens and returns the new root
    open(dir: string): Promise<string>;
    list(): Promise<LibraryNode[]>;
    read(path: string): Promise<Uint8Array>;
    write(path: string, data: Uint8Array | string, overwrite?: boolean): Promise<void>; // "EXISTS: …" error unless overwrite
    rename(from: string, to: string): Promise<void>;
    trash(path: string): Promise<void>;
    mkdir(path: string): Promise<void>;
    rmdir(path: string): Promise<void>; // fails unless the folder is empty
    reveal(path: string): Promise<void>;
    onChanged(cb: () => void): () => void;
  };
}
