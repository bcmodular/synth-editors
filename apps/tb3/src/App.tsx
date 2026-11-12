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
import { paramTarget } from "./editor/ccTargets";
import { useCcLearn } from "./editor/useCcLearn";
import type { CcLearn } from "./editor/useCcLearn";
import { useLaunchkey } from "./editor/useLaunchkey";
import { useLaunchpad } from "./editor/useLaunchpad";
import { useLibrary, walk } from "./editor/useLibrary";
import { useSession } from "./editor/useSession";
import type { Session } from "./editor/useSession";
import { useSetActions } from "./editor/useSetActions";
import { useTb3Audio } from "./editor/useTb3Audio";
import { useTb3Midi } from "./editor/useTb3Midi";
import { useUndoKeys } from "./editor/useUndoKeys";
import { DialogHost } from "./ui/Dialog";
import { TooltipLayer } from "./ui/Tooltip";

// Esc backs out of one thing at a time: CC learn, slot modes, then assign mode.
function useEscape(learn: CcLearn, session: Session, disarm: (() => void) | null) {
  const { learning, cancel } = learn;
  useEffect(() => {
    const steps: [boolean, () => void][] = [
      [learning !== null, cancel],
      [session.mode !== null, () => session.setMode(null)],
      [disarm !== null, () => disarm?.()],
    ];
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") steps.find(([on]) => on)?.[1]();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [learning, cancel, session, disarm]);
}

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
  const audio = useTb3Audio();
  const session = useSession(midi.tb3, setError);
  sessionRef.current = session;
  useLaunchpad(midi, session);
  const ccLearn = useCcLearn();
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

  useEscape(ccLearn, session, armed ? () => setArmed(null) : null);

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

  const { listenFor } = ccLearn;
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
      learning: ccLearn.learning === "pick",
      learnTo: (def) => listenFor(paramTarget(def.id)),
    };
  }, [patch, armed, session, ccLearn.learning, listenFor]);

  const changeTuning = (v: number) => {
    setTuning(v);
    session.push("global_tuning", globalTuningCc(midi.channel - 1, v));
  };

  useLaunchkey(midi, ccLearn, {
    patch: session.activePatch,
    setParam: editor.setParam,
    tuning,
    setTuning: changeTuning,
    morph: session.morphTarget === null ? null : session.morphAmount,
    setMorph: session.setMorph,
  });

  const auditioning = session.previewKey ? "auditioning" : "";
  if (!midi.access && !midi.error)
    return (
      <main className="app">
        <p className="status">Requesting MIDI access…</p>
      </main>
    );

  return (
    <EditorContext.Provider value={editor}>
      <main ref={setMainEl} className={`app ${editor.armed || editor.learning ? "assigning" : ""} ${auditioning}`}>
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
              audio={audio}
              ccLearn={ccLearn}
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
            <VcoSumSection audio={audio} />
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
