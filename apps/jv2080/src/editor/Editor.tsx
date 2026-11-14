// The patch editor: top strip, common row and the four tone columns.

import { useEffect, useMemo, useRef } from "react";
import type { JvLink } from "../link/useJvLink";
import { CommonRow } from "./CommonRow";
import { EditorContext } from "./EditorContext";
import { ToneColumn } from "./ToneColumn";
import { TopStrip } from "./TopStrip";
import { useJvSession } from "./useJvSession";

export function Editor({ link, onSpike }: { link: JvLink; onSpike: () => void }) {
  const session = useJvSession(link);
  const { patch, setValue, syncFromJv } = session;
  const ready = link.outName !== "" && link.inName !== "" && link.outputs.length > 0;

  // Read the JV's patch once, as soon as the ports are known.
  const triedRead = useRef(false);
  useEffect(() => {
    if (!ready || triedRead.current) return;
    triedRead.current = true;
    void syncFromJv();
  }, [ready, syncFromJv]);

  const api = useMemo(() => (patch ? { patch, setValue } : null), [patch, setValue]);
  return (
    <main className="editor">
      <TopStrip link={link} session={session} onSpike={onSpike} />
      {api ? (
        <EditorContext.Provider value={api}>
          <CommonRow />
          <div className="tones">
            {[0, 1, 2, 3].map((t) => <ToneColumn key={t} tone={t} />)}
          </div>
        </EditorContext.Provider>
      ) : (
        <p className="empty">{ready ? "Reading the patch from the JV…" : "Choose the JV's MIDI ports, then SYNC FROM JV."}</p>
      )}
    </main>
  );
}
