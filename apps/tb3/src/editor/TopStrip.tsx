// Top strip: TB-3 sync, undo and the settings window's buttons, perform controls (accent, global tuning) and parameter
// assign. PORTA · BEND is in sections.tsx; PATCH, SET and MORPH are in PatchesBlock.tsx.
import { GLOBAL_TUNING_DISPLAY } from "../core/display";
import { getRaw } from "../core/patch";
import { paramById } from "../core/params";
import { Knob } from "../ui/Knob";
import { Section } from "../ui/controls";
import { KEYS } from "../ui/platform";
import { ASSIGN_SLOTS, useEditor } from "./EditorContext";
import { PERFORM_HELP } from "../core/help";
import { sectionHelp } from "./help/content";
import { HelpButton } from "./help/HelpPanel";
import { ParamKnob } from "./Param";
import type { SettingsTab } from "./useSettingsWindow";
import type { Tb3Midi } from "./useTb3Midi";

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
  onSettings: (tab?: SettingsTab) => void; // no tab: the one last shown
  onSyncTo: () => void;
  hasPatch: boolean;
  history: UndoControls;
}) {
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
          <button className="btn" title="Controller CCs: learn and assign" onClick={() => p.onSettings("cc")}>
            CC
          </button>
          <button className="btn" title={`Ports, controllers, audio and library (${KEYS.settings})`} onClick={() => p.onSettings()}>
            SETTINGS
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
    </Section>
  );
}

// Global tuning is CC 104, not part of the patch: local state, sent only.
export function PerformBlock(p: { tuning: number; onTuning: (v: number) => void; connected: boolean }) {
  return (
    <Section title="PERFORM" className="perform"
      info={<HelpButton label="perform" useContent={sectionHelp(PERFORM_HELP)} side={<PerformBlock {...p} />} sideWidth={310} />}>
      <div className="knobrow">
        <ParamKnob id="accent" label="ACCENT" side />
        <Knob
          label="GLOBAL TUNE"
          value={p.tuning}
          max={127}
          center={64}
          format={(v) => GLOBAL_TUNING_DISPLAY[v] ?? String(v)}
          onChange={p.onTuning}
          disabled={!p.connected}
          side
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
