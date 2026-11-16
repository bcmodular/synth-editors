// The app: the library sidebar (PATCH, SET and the library, shown or hidden from the top strip), then the patch editor:
// top strip, common row and the four tone columns. The whole of it is zoomed to fit the window.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { JvLink } from "../link/useJvLink";
import { DialogHost } from "../ui/Dialog";
import { CommonRow } from "./CommonRow";
import { isDemo } from "./demoPatch";
import { EditorContext } from "./EditorContext";
import { LibraryBrowser } from "./LibraryBrowser";
import { PatchBlock, SetBlock } from "./PatchesBlock";
import { ToneColumn } from "./ToneColumn";
import { TopStrip } from "./TopStrip";
import { useFitZoom } from "./useFitZoom";
import { useJvSession, type JvSession } from "./useJvSession";
import { useLibrary, walk, type Library } from "./useLibrary";
import { useSetActions } from "./useSetActions";
import { useUndoKeys } from "./useUndoKeys";

// What shows before there's a patch to edit.
function waitingMessage(portsReady: boolean, readFailed: boolean): string {
  if (readFailed) return "No reply from the JV. Check the ports and the MIDI ▾ settings, then SYNC FROM JV.";
  return portsReady ? "Reading the patch from the JV…" : "Choose the JV's MIDI ports, then SYNC FROM JV.";
}

const portsReady = (link: JvLink) => link.outName !== "" && link.inName !== "" && link.outputs.length > 0;

// Once the ports are known (never in demo mode): a patch kept from the last session goes to the JV, so the JV plays
// what the editor shows; otherwise the JV's patch is read in. Returns whether the ports are known.
function useFirstContact(link: JvLink, demo: boolean, session: JvSession): boolean {
  const ready = portsReady(link);
  const shouldContact = ready && !demo;
  const done = useRef(false);
  const { activePatch, syncFromJv, syncToJv } = session;
  useEffect(() => {
    if (!shouldContact || done.current) return;
    done.current = true;
    void (activePatch ? syncToJv() : syncFromJv());
  }, [shouldContact, activePatch, syncFromJv, syncToJv]);
  return ready;
}

// Esc backs out of a slot mode (DELETE, GRAB).
function useEscape(session: JvSession) {
  const { mode, setMode } = session;
  useEffect(() => {
    if (!mode) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMode(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mode, setMode]);
}

// An error message for a few seconds (a file that wouldn't save or open, an undo step that failed).
function useToast() {
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!error) return;
    const t = setTimeout(() => setError(null), 6000);
    return () => clearTimeout(t);
  }, [error]);
  return { error, setError };
}

const SIDE_KEY = "jv2080.sidebar";

function useSidebar() {
  const [open, setOpen] = useState(() => {
    try {
      return localStorage.getItem(SIDE_KEY) !== "closed";
    } catch {
      return true;
    }
  });
  const toggle = useCallback(() => setOpen((o) => {
    try {
      localStorage.setItem(SIDE_KEY, o ? "closed" : "open");
    } catch {
      // Remembering it is a convenience.
    }
    return !o;
  }), []);
  return { open, toggle };
}

// Every folder in the library, "" for the library folder itself.
const foldersOf = (library: Library) =>
  ["", ...Array.from(walk(library.tree), (e) => (e.kind === "dir" ? e.path : null)).filter((f): f is string => f !== null)];

function Sidebar(p: { session: JvSession; library: Library; onError: (msg: string) => void }) {
  const { session, library } = p;
  const [folder, setFolder] = useState("");
  const folders = useMemo(() => foldersOf(library), [library]);
  const actions = useSetActions(session, folder, folders, p.onError);
  const findPatch = (path: string) => {
    for (const e of walk(library.tree)) if (e.path === path) return e.patch;
    return undefined;
  };
  return (
    <aside className="side">
      <PatchBlock session={session} actions={actions} hasLibrary={Boolean(library.root)} />
      <SetBlock session={session} actions={actions} findPatch={findPatch} />
      <LibraryBrowser library={library} session={session} actions={actions} folder={folder} onFolder={setFolder}
        onError={p.onError} />
    </aside>
  );
}

function EditorApp({ link }: { link: JvLink }) {
  const [demo] = useState(isDemo);
  const { error, setError } = useToast();
  const session = useJvSession(link, { demo, onError: setError });
  const { patch, setValue, sendParam, resync: reread } = session;
  const ready = useFirstContact(link, demo, session);
  useUndoKeys(session);
  useEscape(session);
  const library = useLibrary();
  const side = useSidebar();

  const [root, setRoot] = useState<HTMLElement | null>(null);
  useFitZoom(root);

  const resync = useCallback(() => void (demo || reread()), [demo, reread]);
  const api = useMemo(() => (patch ? { patch, setValue, sendParam, resync } : null), [patch, setValue, sendParam, resync]);
  return (
    <EditorContext.Provider value={api}>
      <main className={`app ${session.previewKey ? "auditioning" : ""}`} ref={setRoot}>
        {side.open && <Sidebar session={session} library={library} onError={setError} />}
        <div className="editor">
          <TopStrip link={link} session={session} sideOpen={side.open} onToggleSide={side.toggle} />
          {api ? (
            <>
              <CommonRow />
              <div className="tones">
                {[0, 1, 2, 3].map((t) => <ToneColumn key={t} tone={t} />)}
              </div>
            </>
          ) : (
            <p className="empty">{waitingMessage(ready, session.readFailed)}</p>
          )}
        </div>
      </main>
      {error && <div className="toast" onClick={() => setError(null)}>{error}</div>}
    </EditorContext.Provider>
  );
}

export function Editor({ link }: { link: JvLink }) {
  return (
    <DialogHost>
      <EditorApp link={link} />
    </DialogHost>
  );
}
