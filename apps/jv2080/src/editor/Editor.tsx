// The patch editor: top strip, common row and the four tone columns.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { JvLink } from "../link/useJvLink";
import { CommonRow } from "./CommonRow";
import { demoPatch, isDemo } from "./demoPatch";
import { EditorContext } from "./EditorContext";
import { ToneColumn } from "./ToneColumn";
import { TopStrip } from "./TopStrip";
import { useJvSession } from "./useJvSession";

export function Editor({ link, onSpike }: { link: JvLink; onSpike: () => void }) {
  const [demo] = useState(isDemo);
  const [initial] = useState(() => (demo ? demoPatch() : null));
  const session = useJvSession(link, initial, demo);
  const { patch, setValue, sendParam, syncFromJv } = session;
  const ready = link.outName !== "" && link.inName !== "" && link.outputs.length > 0;

  // Read the JV's patch once, as soon as the ports are known.
  const triedRead = useRef(false);
  useEffect(() => {
    if (demo || !ready || triedRead.current) return;
    triedRead.current = true;
    void syncFromJv();
  }, [demo, ready, syncFromJv]);

  const resync = useCallback(() => void (demo || syncFromJv()), [demo, syncFromJv]);
  const api = useMemo(() => (patch ? { patch, setValue, sendParam, resync } : null), [patch, setValue, sendParam, resync]);
  return (
    <EditorContext.Provider value={api}>
      <main className="editor">
        <TopStrip link={link} session={session} onSpike={onSpike} />
        {api ? (
          <>
            <CommonRow />
            <div className="tones">
              {[0, 1, 2, 3].map((t) => <ToneColumn key={t} tone={t} />)}
            </div>
          </>
        ) : (
          <p className="empty">{ready ? "Reading the patch from the JV…" : "Choose the JV's MIDI ports, then SYNC FROM JV."}</p>
        )}
      </main>
    </EditorContext.Provider>
  );
}
