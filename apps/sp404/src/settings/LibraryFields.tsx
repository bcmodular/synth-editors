// Settings › FX LIBRARY: where the library file is, and copying it out (EXPORT) or in (IMPORT). Import replaces the
// presets, defaults, recent values, scenes and Exclude tuning; the buses keep what they're playing.

import { useEffect, useState } from "react";
import {
  exportLibrary, hasLibraryFile, importLibrary, isLibraryJson, libraryJson, libraryPath, revealLibrary,
} from "../fx/libraryFile";
import type { Fx } from "../fx/useFx";

const IMPORT_QUESTION = "Replace the FX library (presets, defaults, recent values and scenes) with this file's? "
  + "Export first to keep a copy of the current one.";

function useImport(fx: Fx, say: (note: string) => void) {
  return async () => {
    const text = await importLibrary();
    if (text === undefined) return;
    if (!isLibraryJson(text)) return say("That file isn't an SP-404 FX library.");
    if (!window.confirm(IMPORT_QUESTION)) return;
    fx.importJson(text);
    say("Imported.");
  };
}

export function LibraryFields({ fx }: { fx: Fx }) {
  const [where, setWhere] = useState("");
  const [note, setNote] = useState("");
  useEffect(() => void libraryPath().then(setWhere), []);
  const doImport = useImport(fx, setNote);
  const doExport = async () => {
    const written = await exportLibrary(libraryJson(fx.state));
    if (written) setNote(`Exported to ${written}.`);
  };
  if (!hasLibraryFile()) return null;
  return (
    <>
      <div className="lbl">FX LIBRARY</div>
      <div className="note">
        Presets, defaults, recent values and scenes are saved as you go{where ? ` to ${where}` : ""}.
      </div>
      <div className="row libbtns">
        <button className="btn" onClick={() => void doExport()}>EXPORT…</button>
        <button className="btn" onClick={() => void doImport()}>IMPORT…</button>
        <button className="btn" onClick={() => void revealLibrary()}>SHOW FILE</button>
      </div>
      {note && <div className="note" role="status">{note}</div>}
    </>
  );
}
