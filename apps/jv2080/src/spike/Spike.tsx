// Phase 1 hardware spike for the JV-2080 (docs/jv2080-design.md): read the temporary patch with RQ1 and show it
// decoded, send single DT1s, send the whole patch back, and save it as a .syx for Phase 2's tests.

import { useCallback, useEffect, useRef, useState } from "react";
import { emptyPatch, patchComplete, patchName, patchToDt1s, placeDt1 } from "../core/patch";
import { parseDt1 } from "../core/sysex";
import { Dt1Panel } from "./Dt1Panel";
import { LogPanel } from "./LogPanel";
import { PatchView } from "./PatchView";
import { PortsPanel } from "./PortsPanel";
import { ProgramPanel } from "./ProgramPanel";
import { readPatch, sendPaced } from "./readPatch";
import { useJvLink } from "./useJvLink";

function download(messages: number[][], name: string) {
  const blob = new Blob([new Uint8Array(messages.flat())], { type: "application/octet-stream" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${name.trim() || "patch"}.syx`;
  a.click();
  URL.revokeObjectURL(a.href);
}

export function Spike() {
  const link = useJvLink();
  const patch = useRef(emptyPatch());
  const [, setVersion] = useState(0);
  const [busy, setBusy] = useState(false);
  const redraw = useCallback(() => setVersion((v) => v + 1), []);

  // DT1s that arrive outside a read (eg. a dump started on the JV) land in the patch too.
  useEffect(() => link.subscribe((msg) => {
    const dt = parseDt1(msg);
    if (dt && placeDt1(patch.current, dt.addr, dt.data)) redraw();
  }), [link.subscribe, redraw]);

  const read = async () => {
    setBusy(true);
    patch.current = emptyPatch();
    redraw();
    const ok = await readPatch(link, patch.current, redraw);
    link.note(ok ? `read "${patchName(patch.current.blocks)}"` : "read incomplete");
    setBusy(false);
  };
  const complete = patchComplete(patch.current);

  return (
    <main className="spike">
      <h1>JV-2080 · Phase 1 spike</h1>
      <PortsPanel link={link} />
      <section>
        <h2>Temporary patch</h2>
        <div className="row">
          <button disabled={busy} onClick={() => void read()}>READ PATCH (RQ1)</button>
          <button disabled={busy || !complete} onClick={() => void sendPaced(link, patchToDt1s(patch.current.blocks, link.device), "DT1 patch")}>SEND PATCH BACK (9 × DT1)</button>
          <button disabled={!complete} onClick={() => download(patchToDt1s(patch.current.blocks, link.device), patchName(patch.current.blocks))}>SAVE .SYX</button>
        </div>
        <PatchView patch={patch.current} />
      </section>
      <ProgramPanel link={link} read={read} />
      <Dt1Panel
        link={link}
        valueOf={(b, o) => patch.current.blocks[b]![o] ?? 0}
        onChange={(b, o, v) => (patch.current.blocks[b]![o] = v)}
      />
      <LogPanel log={link.log} onClear={link.clearLog} />
    </main>
  );
}
