// TB-3 editor, layout A (signal flow). See docs/tb3-phase2-design.md.
import { useEffect, useMemo, useRef, useState } from "react";
import { globalTuningCc } from "./core/display";
import type { EfxNum } from "./core/efx";
import { encodeEfxByte, encodeParam, patchToSysex, setEfxRaw, setEfxType, setRaw } from "./core/patch";
import type { Patch } from "./core/patch";
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
  VcaSection,
  VcfSection,
  VcoSection,
} from "./editor/sections";
import { AssignBlock, MorphPlaceholder, PatchGridPlaceholder, PerformBlock, Tb3Block } from "./editor/TopStrip";
import { demoPatch } from "./editor/demoPatch";
import { createEditQueue } from "./editor/editQueue";
import { useFitZoom } from "./editor/useFitZoom";
import { useTb3Midi } from "./editor/useTb3Midi";

export function App() {
  const [patch, setPatch] = useState<Patch | null>(() =>
    import.meta.env.DEV && location.search.includes("demo") ? demoPatch() : null,
  );
  const [armed, setArmed] = useState<AssignSlotId | null>(null);
  const [tuning, setTuning] = useState(64);
  const patchRef = useRef(patch);
  patchRef.current = patch;
  const [mainEl, setMainEl] = useState<HTMLElement | null>(null);
  useFitZoom(mainEl);
  // Synced patches update the ref at once, so an edit landing before the next render builds on them.
  const midi = useTb3Midi((p) => {
    patchRef.current = p;
    setPatch(p);
  });
  const queue = useMemo(() => createEditQueue(midi.sendTb3), [midi.sendTb3]);

  useEffect(() => {
    if (!armed) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setArmed(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [armed]);

  const editor = useMemo<Editor>(() => {
    const setParamDef = (def: ParamDef, raw: number) => {
      const p = patchRef.current;
      if (!p) return;
      const next = setRaw(p, def, raw);
      patchRef.current = next;
      setPatch(next);
      queue.push(def.id, encodeParam(def, raw));
    };
    return {
      patch,
      setParam: (id, raw) => setParamDef(paramById(id), raw),
      setEfxType: (efx: EfxNum, type: number) => {
        const p = patchRef.current;
        if (!p) return;
        const next = setEfxType(p, efx, type);
        patchRef.current = next;
        setPatch(next);
        queue.push(`efx:${efx}:0`, encodeEfxByte(efx, 0, type));
      },
      setEfxByte: (efx: EfxNum, offset: number, raw: number) => {
        const p = patchRef.current;
        if (!p) return;
        const next = setEfxRaw(p, efx, offset, raw);
        patchRef.current = next;
        setPatch(next);
        queue.push(`efx:${efx}:${offset}`, encodeEfxByte(efx, offset, raw));
      },
      armed,
      arm: setArmed,
      assignTo: (def) => {
        if (!armed || def.assignId === undefined) return;
        setParamDef(paramById(armed), def.assignId);
        setArmed(null);
      },
    };
  }, [patch, armed, queue]);

  const changeTuning = (v: number) => {
    setTuning(v);
    queue.push("global_tuning", globalTuningCc(midi.channel - 1, v));
  };

  if (!midi.access && !midi.error) return <main className="app"><p className="status">Requesting MIDI access…</p></main>;

  return (
    <EditorContext.Provider value={editor}>
      <main ref={setMainEl} className={`app ${armed ? "assigning" : ""}`}>
        <div className="strip">
          <Tb3Block midi={midi} hasPatch={Boolean(patch)} onSyncTo={() => patch && midi.sendAllToTb3(patchToSysex(patch))} />
          <PatchGridPlaceholder />
          <MorphPlaceholder />
          <PerformBlock tuning={tuning} onTuning={changeTuning} connected={midi.connected} />
          <AssignBlock />
        </div>
        <div className="voice">
          <VcoSection />
          <ModSection />
          <VcfSection />
          <VcaSection />
          <DistSection />
        </div>
        <div className="modfx">
          <LfoSection />
          <EfxSection efx={1} />
          <EfxSection efx={2} />
          <PortaBendSection />
        </div>
      </main>
    </EditorContext.Provider>
  );
}
