// TB-3 editor, layout A (signal flow). See docs/tb3-phase2-design.md and tb3-phase3-design.md.
import { useEffect, useMemo, useRef, useState } from "react";
import { globalTuningCc } from "./core/display";
import type { EfxNum } from "./core/efx";
import { encodeEfxByte, encodeParam, setEfxRaw, setEfxType, setRaw } from "./core/patch";
import { paramById } from "./core/params";
import type { ParamDef } from "./core/params";
import { EditorContext } from "./editor/EditorContext";
import type { AssignSlotId, Editor } from "./editor/EditorContext";
import { EfxSection } from "./editor/EfxSection";
import {
  DistSection,
  LfoSection,
  ModSection,
  PortaBendSection,
  RingModSection,
  VcaSection,
  VcfSection,
  VcoSection,
  VcoSumSection,
} from "./editor/sections";
import { LibraryBrowser } from "./editor/LibraryBrowser";
import { MorphBlock, PatchBlock, SetBlock } from "./editor/PatchesBlock";
import { AssignBlock, PerformBlock, Tb3Block } from "./editor/TopStrip";
import { demoPatch } from "./editor/demoPatch";
import { useFitZoom } from "./editor/useFitZoom";
import { useLibrary, walk } from "./editor/useLibrary";
import { useSession } from "./editor/useSession";
import type { Session } from "./editor/useSession";
import { useSetActions } from "./editor/useSetActions";
import { useTb3Midi } from "./editor/useTb3Midi";
import { useUndoKeys } from "./editor/useUndoKeys";
import { DialogHost } from "./ui/Dialog";
import { TooltipLayer } from "./ui/Tooltip";

export function App() {
  return (
    <DialogHost>
      <EditorApp />
      <TooltipLayer />
    </DialogHost>
  );
}

function EditorApp() {
  const [armed, setArmed] = useState<AssignSlotId | null>(null);
  const [tuning, setTuning] = useState(64);
  const [folder, setFolder] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [mainEl, setMainEl] = useState<HTMLElement | null>(null);
  useFitZoom(mainEl);
  const sessionRef = useRef<Session | null>(null);
  const midi = useTb3Midi((p) => sessionRef.current?.fromTb3(p));
  const session = useSession(midi.tb3, setError);
  sessionRef.current = session;
  const library = useLibrary();
  const folders = useMemo(
    () => ["", ...Array.from(walk(library.tree), (e) => (e.kind === "dir" ? e.path : null)).filter((f) => f !== null)],
    [library.tree],
  );
  const actions = useSetActions(session, folder, folders, setError);
  const patch = session.patch;

  useEffect(() => {
    if (import.meta.env.DEV && location.search.includes("demo") && !sessionRef.current?.patch) {
      sessionRef.current?.fromTb3(demoPatch());
    }
  }, []);

  // Esc backs out of one thing at a time: slot modes, then assign mode.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (session.mode) session.setMode(null);
      else if (armed) setArmed(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [armed, session]);

  useUndoKeys(session);

  useEffect(() => {
    if (!error) return;
    const t = setTimeout(() => setError(null), 6000);
    return () => clearTimeout(t);
  }, [error]);

  const findPatch = (path: string) => {
    for (const e of walk(library.tree)) if (e.path === path) return e.patch;
    return undefined;
  };

  const editor = useMemo<Editor>(() => {
    const setParamDef = (def: ParamDef, raw: number) =>
      session.edit((p) => setRaw(p, def, raw), def.id, encodeParam(def, raw), def.name);
    return {
      patch,
      setParam: (id, raw) => setParamDef(paramById(id), raw),
      setEfxType: (efx: EfxNum, type: number) =>
        session.edit((p) => setEfxType(p, efx, type), `efx:${efx}:0`, encodeEfxByte(efx, 0, type), `EFX${efx} TYPE`),
      setEfxByte: (efx: EfxNum, offset: number, raw: number) =>
        session.edit(
          (p) => setEfxRaw(p, efx, offset, raw),
          `efx:${efx}:${offset}`,
          encodeEfxByte(efx, offset, raw),
          `EFX${efx} edit`,
        ),
      armed,
      arm: setArmed,
      assignTo: (def) => {
        if (!armed || def.assignId === undefined) return;
        setParamDef(paramById(armed), def.assignId);
        setArmed(null);
      },
    };
  }, [patch, armed, session]);

  const changeTuning = (v: number) => {
    setTuning(v);
    session.push("global_tuning", globalTuningCc(midi.channel - 1, v));
  };

  if (!midi.access && !midi.error)
    return (
      <main className="app">
        <p className="status">Requesting MIDI access…</p>
      </main>
    );

  return (
    <EditorContext.Provider value={editor}>
      <main ref={setMainEl} className={`app ${armed ? "assigning" : ""} ${session.previewKey ? "auditioning" : ""}`}>
        <aside className="side">
          <PatchBlock session={session} actions={actions} hasLibrary={Boolean(library.root)} />
          <SetBlock session={session} actions={actions} findPatch={findPatch} />
          <MorphBlock session={session} />
          <LibraryBrowser
            library={library}
            session={session}
            actions={actions}
            folder={folder}
            onFolder={setFolder}
            onError={setError}
          />
        </aside>
        <div className="editor">
          <div className="strip">
            <Tb3Block
              midi={midi}
              hasPatch={Boolean(session.activePatch)}
              onSyncTo={session.sendAll}
              history={session}
            />
            <PerformBlock tuning={tuning} onTuning={changeTuning} connected={midi.connected} />
            <PortaBendSection />
            <AssignBlock />
          </div>
          <div className="osc">
            <VcoSection />
            <VcoSumSection />
            <ModSection />
            <RingModSection />
          </div>
          <div className="shape">
            <VcfSection />
            <VcaSection />
            <LfoSection />
          </div>
          <div className="fx">
            <DistSection />
            <EfxSection efx={1} />
            <EfxSection efx={2} />
          </div>
        </div>
        {error && (
          <div className="toast" onClick={() => setError(null)}>
            {error}
          </div>
        )}
      </main>
    </EditorContext.Provider>
  );
}
