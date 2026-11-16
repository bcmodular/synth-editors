// The settings window (docs/tb3-phase5-design.md): every setting in one place, by tab: MIDI (the TB-3's ports and
// channel), CONTROLLERS (Launchpad and keyboard), CC (learned assignments), AUDIO (LIVE's input) and LIBRARY. Opened
// from SETTINGS or CC in the TB-3 block, ⌘, or the app menu; state in useSettingsWindow.ts.
import { useRef, useState } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { PROFILE_ORDER, profileNamed } from "@synth-editors/launchpad";
import { useDismiss } from "../ui/useDismiss";
import { CcPane } from "./CcSettings";
import type { CcLearn } from "./useCcLearn";
import type { LaunchpadSettings } from "./useLaunchpad";
import { SETTINGS_TABS } from "./useSettingsWindow";
import type { SettingsTab, SettingsWindowState } from "./useSettingsWindow";
import type { Tb3Audio } from "./useTb3Audio";
import type { PortRole, Tb3Midi } from "./useTb3Midi";

const TAB_LABELS: Record<SettingsTab, string> = {
  midi: "MIDI",
  controllers: "CONTROLLERS",
  cc: "CC",
  audio: "AUDIO",
  library: "LIBRARY",
};

export interface LibrarySettings {
  available: boolean; // false in a plain browser: no file access
  root: string | null;
  choose: () => Promise<void>;
}

export interface SettingsProps {
  state: SettingsWindowState;
  midi: Tb3Midi;
  audio: Tb3Audio;
  ccLearn: CcLearn;
  launchpad: LaunchpadSettings;
  library: LibrarySettings;
}

function Field(p: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="port">
      <span className="lbl">{p.label}</span>
      {p.children}
      {p.hint && <span className="hint">{p.hint}</span>}
    </label>
  );
}

function PortSelect(p: { midi: Tb3Midi; role: PortRole; label: string; hint?: string }) {
  const m = p.midi;
  const list = p.role.endsWith("Out") ? m.outputs : m.inputs;
  return (
    <Field label={p.label} hint={p.hint}>
      <select value={m.ports[p.role] ?? ""} onChange={(e) => m.choosePort(p.role, e.target.value)}>
        <option value="">— none —</option>
        {list.map((port) => (
          <option key={port.id} value={port.name}>
            {port.name}
          </option>
        ))}
      </select>
    </Field>
  );
}

function MidiPane(p: { midi: Tb3Midi }) {
  const m = p.midi;
  const [showLog, setShowLog] = useState(false);
  return (
    <>
      <PortSelect midi={m} role="tb3In" label="TB-3 IN" />
      <PortSelect midi={m} role="tb3Out" label="TB-3 OUT" />
      <Field label="TB-3 CHANNEL" hint="The TB-3's MIDI channel (its own setting)">
        <select value={m.channel} onChange={(e) => m.setChannel(Number(e.target.value))}>
          {Array.from({ length: 16 }, (_, i) => (
            <option key={i} value={i + 1}>
              {i + 1}
            </option>
          ))}
        </select>
      </Field>
      <div className="row">
        <button
          className={`btn ${m.quietSwitch ? "on" : ""}`}
          title="Mute the TB-3 while switching patches, so a switch during a pattern is a short gap rather than a pop"
          onClick={() => m.setQuietSwitch(!m.quietSwitch)}
        >
          <span className="l" />
          QUIET SWITCH
        </button>
        <button className="btn" onClick={() => setShowLog((s) => !s)}>
          {showLog ? "HIDE LOG" : "SHOW LOG"}
        </button>
      </div>
      {showLog && <pre className="log">{m.log.join("\n")}</pre>}
    </>
  );
}

function ControllersPane(p: { midi: Tb3Midi; launchpad: LaunchpadSettings }) {
  const lp = p.launchpad;
  return (
    <>
      <PortSelect midi={p.midi} role="lpIn" label="LAUNCHPAD IN" hint="A Launchpad Pro (Mk1): its Standalone port" />
      <PortSelect midi={p.midi} role="lpOut" label="LAUNCHPAD OUT" />
      <Field label="LAUNCHPAD BRIGHTNESS" hint="How bright filled slots are; the Launchpad's User button cycles it too">
        <select value={lp.profile} onChange={(e) => lp.setProfile(profileNamed(e.target.value))}>
          {PROFILE_ORDER.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      </Field>
      <PortSelect midi={p.midi} role="keysIn" label="KEYS IN" hint="A keyboard: notes go to the TB-3, knobs as set under CC" />
    </>
  );
}

// The audio input for VCO MIX's LIVE view. Names only show once audio input has been allowed, which the first LIVE
// asks for; until then the menu just offers the automatic choice.
function AudioPane(p: { audio: Tb3Audio }) {
  const a = p.audio;
  const named = a.inputs.filter((d) => d.name);
  return (
    <Field label="AUDIO IN (LIVE)" hint="What VCO MIX's LIVE view listens to: the TB-3's USB audio, found by name">
      <select value={a.inputName ?? ""} onChange={(e) => a.chooseInput(e.target.value)}>
        <option value="">Automatic (TB-3)</option>
        {named.map((d) => (
          <option key={d.id} value={d.name}>
            {d.name}
          </option>
        ))}
      </select>
    </Field>
  );
}

function LibraryPane(p: { library: LibrarySettings }) {
  const lib = p.library;
  if (!lib.available) return <p className="status">The library needs the app; it isn't available in a browser.</p>;
  return (
    <>
      <Field label="LIBRARY FOLDER" hint="Patches (.syx) and sets (.tb3set), in any sub-folders">
        <span className="v libroot" title={lib.root ?? undefined}>
          {lib.root ?? "None chosen"}
        </span>
      </Field>
      <div className="row">
        <button className="btn" onClick={() => void lib.choose()}>
          {lib.root ? "CHANGE…" : "CHOOSE…"}
        </button>
      </div>
    </>
  );
}

function Pane(p: SettingsProps) {
  const { state, midi } = p;
  switch (state.tab) {
    case "midi":
      return <MidiPane midi={midi} />;
    case "controllers":
      return <ControllersPane midi={midi} launchpad={p.launchpad} />;
    case "cc":
      return <CcPane learn={p.ccLearn} hasKeys={Boolean(midi.ports.keysIn)} onPick={state.pick} />;
    case "audio":
      return <AudioPane audio={p.audio} />;
    case "library":
      return <LibraryPane library={p.library} />;
  }
}

export function SettingsWindow(p: SettingsProps) {
  const { state } = p;
  const panel = useRef<HTMLDivElement>(null);
  useDismiss(panel, state.close, ".dialog-back");
  return createPortal(
    <div className="settings-back">
      <div className="settingswin" ref={panel} role="dialog" aria-label="Settings">
        <div className="settings-head">
          <h3>SETTINGS</h3>
          <button className="btn" onClick={state.close}>
            CLOSE
          </button>
        </div>
        <div className="settings-body">
          <nav className="settings-tabs">
            {SETTINGS_TABS.map((t) => (
              <button key={t} className={`btn ${state.tab === t ? "sel" : ""}`} onClick={() => state.choose(t)}>
                {TAB_LABELS[t]}
              </button>
            ))}
          </nav>
          <div className={`settings-pane settings-${state.tab}`}>
            <Pane {...p} />
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
