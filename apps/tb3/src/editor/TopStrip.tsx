// Top strip: TB-3 sync + MIDI settings, perform controls (accent, global tuning) and parameter
// assign. PORTA · BEND is in sections.tsx; PATCH, SET and MORPH are in PatchesBlock.tsx.
import { useState } from "react";
import { GLOBAL_TUNING_DISPLAY } from "../core/display";
import { getRaw } from "../core/patch";
import { paramById } from "../core/params";
import { HFader } from "../ui/Fader";
import { Section } from "../ui/controls";
import { KEYS } from "../ui/platform";
import { CcSettings } from "./CcSettings";
import { ASSIGN_SLOTS, useEditor } from "./EditorContext";
import { ParamH } from "./Param";
import type { CcLearn } from "./useCcLearn";
import type { Tb3Audio } from "./useTb3Audio";
import type { PortRole, Tb3Midi } from "./useTb3Midi";

// UNDO / REDO; hovering names the step.
export interface UndoControls {
  undo: () => void;
  redo: () => void;
  undoLabel: string | null;
  redoLabel: string | null;
}

function UndoButtons(p: { history: UndoControls }) {
  const h = p.history;
  return (
    <>
      <button
        className="btn mini"
        disabled={!h.undoLabel}
        title={h.undoLabel ? `Undo ${h.undoLabel} (${KEYS.undo})` : "Nothing to undo"}
        onClick={h.undo}
      >
        UNDO
      </button>
      <button
        className="btn mini"
        disabled={!h.redoLabel}
        title={h.redoLabel ? `Redo ${h.redoLabel} (${KEYS.redo})` : "Nothing to redo"}
        onClick={h.redo}
      >
        REDO
      </button>
    </>
  );
}

export function Tb3Block(p: {
  midi: Tb3Midi;
  audio: Tb3Audio;
  ccLearn: CcLearn;
  onSyncTo: () => void;
  hasPatch: boolean;
  history: UndoControls;
}) {
  const [open, setOpen] = useState<"midi" | "cc" | null>(null);
  const toggle = (which: "midi" | "cc") => setOpen((o) => (o === which ? null : which));
  const { sync } = p.midi;
  const status = p.midi.error
    ? `MIDI unavailable: ${p.midi.error}`
    : sync.kind === "waiting"
      ? `Receiving ${sync.got}/11…`
      : sync.kind === "error"
        ? sync.message
        : p.hasPatch
          ? `${p.midi.ports.tb3Out ?? "no output"} · ch ${p.midi.channel}`
          : "Sync from TB-3 to start";
  return (
    <Section
      title="TB-3"
      className="tb3"
      extra={
        <span className="row tight">
          <UndoButtons history={p.history} />
          <button className={`btn ${open === "cc" ? "sel" : ""}`} title="Controller CCs" onClick={() => toggle("cc")}>
            CC
          </button>
          <button className={`btn ${open === "midi" ? "sel" : ""}`} onClick={() => toggle("midi")}>
            MIDI
          </button>
        </span>
      }
    >
      <button className={`btn wide ${p.hasPatch ? "" : "pulse"}`} onClick={p.midi.syncFromTb3}>
        SYNC FROM TB-3
      </button>
      <button className="btn wide" disabled={!p.hasPatch} onClick={p.onSyncTo}>
        SYNC TO TB-3
      </button>
      <span className={`status ${sync.kind === "error" || p.midi.error ? "err" : ""}`}>{status}</span>
      {open === "midi" && <MidiSettings midi={p.midi} audio={p.audio} onClose={() => setOpen(null)} />}
      {open === "cc" && (
        <CcSettings learn={p.ccLearn} hasKeys={Boolean(p.midi.ports.keysIn)} onClose={() => setOpen(null)} />
      )}
    </Section>
  );
}

function MidiSettings(p: { midi: Tb3Midi; audio: Tb3Audio; onClose: () => void }) {
  const m = p.midi;
  const [showLog, setShowLog] = useState(false);
  const select = (role: PortRole, label: string, list: { id: string; name: string }[]) => (
    <label className="port">
      <span className="lbl">{label}</span>
      <select value={m.ports[role] ?? ""} onChange={(e) => m.choosePort(role, e.target.value)}>
        <option value="">— none —</option>
        {list.map((port) => (
          <option key={port.id} value={port.name}>
            {port.name}
          </option>
        ))}
      </select>
    </label>
  );
  return (
    <div className="popover settings">
      {select("tb3In", "TB-3 IN", m.inputs)}
      {select("tb3Out", "TB-3 OUT", m.outputs)}
      {select("lpIn", "LAUNCHPAD IN", m.inputs)}
      {select("lpOut", "LAUNCHPAD OUT", m.outputs)}
      {select("keysIn", "KEYS IN", m.inputs)}
      <label className="port">
        <span className="lbl">TB-3 CHANNEL</span>
        <select value={m.channel} onChange={(e) => m.setChannel(Number(e.target.value))}>
          {Array.from({ length: 16 }, (_, i) => (
            <option key={i} value={i + 1}>
              {i + 1}
            </option>
          ))}
        </select>
      </label>
      <AudioInputChoice audio={p.audio} />
      <div className="row">
        <button className="btn" onClick={() => setShowLog((s) => !s)}>
          {showLog ? "HIDE LOG" : "SHOW LOG"}
        </button>
        <button className="btn" onClick={p.onClose}>
          CLOSE
        </button>
      </div>
      {showLog && <pre className="log">{m.log.join("\n")}</pre>}
    </div>
  );
}

// The audio input for VCO MIX's LIVE view. Names only show once audio input has been allowed, which
// the first LIVE asks for; until then the menu just offers the automatic choice.
function AudioInputChoice(p: { audio: Tb3Audio }) {
  const a = p.audio;
  const named = a.inputs.filter((d) => d.name);
  return (
    <label className="port">
      <span className="lbl">AUDIO IN (LIVE)</span>
      <select value={a.inputName ?? ""} onChange={(e) => a.chooseInput(e.target.value)}>
        <option value="">Automatic (TB-3)</option>
        {named.map((d) => (
          <option key={d.id} value={d.name}>
            {d.name}
          </option>
        ))}
      </select>
    </label>
  );
}

// Global tuning is CC 104, not part of the patch: local state, sent only.
export function PerformBlock(p: { tuning: number; onTuning: (v: number) => void; connected: boolean }) {
  return (
    <Section title="PERFORM" className="perform">
      <ParamH id="accent" label="ACCENT" width={170} labelWidth={84} />
      <div className="hrow">
        <span className="lbl" style={{ width: 84 }}>
          GLOBAL TUNE
        </span>
        <HFader
          value={p.tuning}
          max={127}
          center={64}
          format={(v) => GLOBAL_TUNING_DISPLAY[v] ?? String(v)}
          onChange={p.onTuning}
          disabled={!p.connected}
          width={170}
        />
      </div>
    </Section>
  );
}

export function AssignBlock() {
  const ed = useEditor();
  return (
    <Section title="ASSIGN" className="assign">
      <div className="assigns">
        {ASSIGN_SLOTS.map((s) => {
          const def = paramById(s.id);
          const target = ed.patch ? def.display(getRaw(ed.patch, def)) : "–";
          return (
            <button
              key={s.id}
              className={`btn assignbtn ${ed.armed === s.id ? "sel" : ""}`}
              disabled={!ed.patch}
              onClick={() => ed.arm(ed.armed === s.id ? null : s.id)}
            >
              <span className="an">{s.label}</span>
              <span className="v">{target}</span>
            </button>
          );
        })}
      </div>
      {ed.armed && <span className="status">Click a parameter to assign it. Esc cancels.</span>}
    </Section>
  );
}
