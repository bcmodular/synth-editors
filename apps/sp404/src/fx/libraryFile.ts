// Where the FX library is kept (docs/sp404-design.md › FX library file): a JSON file in the app's user data folder,
// saved a moment after each change, through the bridge preload.cjs exposes. Outside Electron (no bridge) it falls
// back to localStorage. Export and Import copy it to or from a file the user picks.

const LOCAL_KEY = "sp404.fx"; // where the state lived before the file, and the fallback
const KIND = "sp404-fx-library";
const VERSION = 1;

// The file's text for a state: marked, so an import can tell an FX library from any other JSON.
export const libraryJson = (state: object): string => JSON.stringify({ kind: KIND, version: VERSION, ...state }, null, 1);

// Whether a file's text is an FX library (or the localStorage state from before the file).
export function isLibraryJson(text: string): boolean {
  try {
    const v = JSON.parse(text) as { kind?: unknown; libs?: unknown };
    return v.kind === KIND || (v.kind === undefined && typeof v.libs === "object");
  } catch {
    return false;
  }
}
const SAVE_DELAY_MS = 800;

interface LibraryBridge {
  load(): Promise<string | null>;
  save(json: string): Promise<void>;
  exportFile(json: string): Promise<string | undefined>; // the path written, or undefined if cancelled
  importFile(): Promise<string | undefined>; // the file's text, or undefined if cancelled
  reveal(): Promise<void>;
  path(): Promise<string>;
}

const bridge = (): LibraryBridge | undefined => (window as unknown as { sp404Library?: LibraryBridge }).sp404Library;

export const hasLibraryFile = (): boolean => bridge() !== undefined;

// The saved library: the file if there is one, else what localStorage held (from before the file, or outside
// Electron).
export async function loadLibrary(): Promise<string | null> {
  const fromFile = await bridge()?.load().catch(() => null);
  return fromFile ?? localStorage.getItem(LOCAL_KEY);
}

export const localLibrary = (): string | null => localStorage.getItem(LOCAL_KEY);

let timer: ReturnType<typeof setTimeout> | undefined;
let pending: string | undefined;

function flush() {
  clearTimeout(timer);
  const json = pending;
  pending = undefined;
  if (json === undefined) return;
  const b = bridge();
  if (b) void b.save(json).catch((e: unknown) => console.warn("Couldn't save the FX library:", e));
  else localStorage.setItem(LOCAL_KEY, json);
}

// Save soon: changes in quick succession (a knob drag) make one write.
export function saveLibrary(json: string) {
  pending = json;
  clearTimeout(timer);
  timer = setTimeout(flush, SAVE_DELAY_MS);
}

window.addEventListener("beforeunload", flush);

export const exportLibrary = (json: string) => bridge()?.exportFile(json) ?? Promise.resolve(undefined);
export const importLibrary = () => bridge()?.importFile() ?? Promise.resolve(undefined);
export const revealLibrary = () => bridge()?.reveal() ?? Promise.resolve();
export const libraryPath = () => bridge()?.path() ?? Promise.resolve("");
