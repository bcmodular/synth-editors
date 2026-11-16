// The patch editor: top strip, common row and the four tone columns.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { JvLink } from "../link/useJvLink";
import { CommonRow } from "./CommonRow";
import { demoPatch, isDemo } from "./demoPatch";
import { EditorContext } from "./EditorContext";
import { ToneColumn } from "./ToneColumn";
import { TopStrip } from "./TopStrip";
import { useFitZoom } from "./useFitZoom";
import { useJvSession } from "./useJvSession";
import { useUndoKeys } from "./useUndoKeys";

// What shows before there's a patch to edit.
function waitingMessage(portsReady: boolean, readFailed: boolean): string {
  if (readFailed) return "No reply from the JV. Check the ports and the MIDI ▾ settings, then SYNC FROM JV.";
  return portsReady ? "Reading the patch from the JV…" : "Choose the JV's MIDI ports, then SYNC FROM JV.";
}

const portsReady = (link: JvLink) => link.outName !== "" && link.inName !== "" && link.outputs.length > 0;

// Read the JV's patch once, as soon as the ports are known (never in demo mode). Returns whether they are.
function useFirstRead(link: JvLink, demo: boolean, syncFromJv: () => Promise<unknown>): boolean {
  const ready = portsReady(link);
  const shouldRead = ready && !demo;
  const triedRead = useRef(false);
  useEffect(() => {
    if (!shouldRead || triedRead.current) return;
    triedRead.current = true;
    void syncFromJv();
  }, [shouldRead, syncFromJv]);
  return ready;
}

export function Editor({ link }: { link: JvLink }) {
  const [demo] = useState(isDemo);
  const [initial] = useState(() => (demo ? demoPatch() : null));
  const session = useJvSession(link, initial, demo);
  const { patch, setValue, sendParam, syncFromJv, resync: reread } = session;
  useUndoKeys(session);
  const ready = useFirstRead(link, demo, syncFromJv);

  const [root, setRoot] = useState<HTMLElement | null>(null);
  useFitZoom(root);

  const resync = useCallback(() => void (demo || reread()), [demo, reread]);
  const api = useMemo(() => (patch ? { patch, setValue, sendParam, resync } : null), [patch, setValue, sendParam, resync]);
  return (
    <EditorContext.Provider value={api}>
      <main className="editor" ref={setRoot}>
        <TopStrip link={link} session={session} />
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
      </main>
    </EditorContext.Provider>
  );
}
