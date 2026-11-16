// The SP-404 MK2 editor window (Layout D): top bar, the FX row (Phase 3) and the pad mixer, drawn at
// 1920 × 1080 and zoomed to fit.

import { useMemo, useState } from "react";
import { useBcr } from "./bcr/useBcr";
import { FxModes, FxRow } from "./fx/FxRow";
import { useFx, type Fx } from "./fx/useFx";
import { KeysView } from "./keys/KeysView";
import { useKeyboard } from "./keys/useKeyboard";
import { useLaunchpad } from "./launchpad/useLaunchpad";
import { bankOf } from "./mixer/banks";
import { Desk } from "./mixer/Desk";
import { MixerSide, type ProjectView } from "./mixer/MixerSide";
import { useDevice, type Device } from "./mixer/useDevice";
import { useMixer } from "./mixer/useMixer";
import { noActivity, type PadActivity } from "./mixer/padHits";
import { usePadHits } from "./mixer/usePadHits";
import { useMixerView } from "./mixer/useMixerView";
import { useShownBanks } from "./mixer/useShownBanks";
import { MeterColumn } from "./scope/MeterColumn";
import { ScopeView } from "./scope/ScopeView";
import { useScopeSet } from "./scope/useScopeSet";
import { SettingsPanel } from "./settings/SettingsPanel";
import { useSettings } from "./settings/useSettings";
import { useFitZoom } from "./ui/useFitZoom";

interface TopBarProps {
  device: Device;
  fx: Fx;
  midiInput?: string;
  bcr?: string;
  launchpad?: string;
  onSettings: () => void;
}

// A controller's link pill: lit with its port's name when connected.
const LinkPill = ({ label, name }: { label: string; name?: string }) => (
  <span className={`pill ${name ? "on" : ""}`} title={name ?? `No ${label} connected`}>{`${label} ${name ? "●" : "○"}`}</span>
);

function TopBar({ device, fx, midiInput, bcr, launchpad, onSettings }: TopBarProps) {
  const { link, device: d, error, connect } = device;
  const midiOutput = fx.outputName;
  const project = d.project === undefined ? "" : ` · PROJECT ${String(d.project + 1).padStart(2, "0")}`;
  const usb = link === "on" ? `USB ●${project}` : link === "connecting" ? "USB …" : "USB ○";
  return (
    <div className="bar">
      <span className="logo">SP-404 MK2</span>
      <span className={`pill ${midiOutput ? "on" : ""}`} title={midiOutput ?? "The SP-404's MIDI isn't connected"}>
        {midiOutput ? "MIDI ● SP-404" : "MIDI ○"}
      </span>
      {midiOutput && !midiInput && <span className="warn">NO PAD NOTES IN</span>}
      <span className={`pill ${link === "on" ? "on" : ""}`}>{usb}</span>
      {link === "off" && <button className="pill" onClick={connect}>CONNECT USB</button>}
      <LinkPill label="LAUNCHPAD" name={launchpad} />
      <LinkPill label="BCR2000" name={bcr} />
      {error && <span className="error" role="alert">{error}</span>}
      <span className="sp" />
      <FxModes fx={fx} />
      <button className="pill" onClick={onSettings}>SETTINGS</button>
    </div>
  );
}

function projectView({ device: d, link }: Device, onRename: (name: string) => void): ProjectView {
  if (link !== "on") return { status: "Not connected" };
  if (d.loading) return { status: "Reading pads…" };
  return { number: String((d.project ?? 0) + 1).padStart(2, "0"), name: d.projectName, onRename };
}

// Pads played come from the SP-404's MIDI notes; without its MIDI input, the hits the status poll saw.
function serialActivity(hit: { pad: number; seq: number } | undefined): PadActivity {
  return hit ? { hits: { [hit.pad]: hit.seq }, held: [] } : noActivity;
}

export function Editor() {
  const [root, setRoot] = useState<HTMLDivElement | null>(null);
  useFitZoom(root);
  const device = useDevice();
  const mixer = useMixer(device);
  const loadedBanks = useMemo(() => new Set(mixer.pads.map((p) => bankOf(p.pad))), [mixer.pads]);
  const banks = useShownBanks(device.device.project, loadedBanks);
  const fx = useFx();
  const bcr = useBcr(fx);
  const launchpad = useLaunchpad(fx);
  const keyboard = useKeyboard(fx);
  const [settings, setSettings] = useSettings();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const midiHits = usePadHits(settings.padMidi);
  const activity = midiHits.inputName ? midiHits.activity : serialActivity(device.device.hit);
  const [view, setView] = useMixerView();
  const scope = useScopeSet(settings);
  return (
    <div className="ld" ref={setRoot}>
      <TopBar device={device} fx={fx} midiInput={midiHits.inputName} bcr={bcr.name}
        launchpad={launchpad.name} onSettings={() => setSettingsOpen(true)} />
      <FxRow fx={fx} />
      <div className="mixer">
        <MixerSide project={projectView(device, mixer.renameProject)} shown={banks.shown} loadedBanks={loadedBanks}
          onToggleBank={banks.toggle} view={view} onView={setView} />
        {view === "desk" && <Desk mixer={mixer} banks={banks.list} midi={settings.padMidi} activity={activity} />}
        {view === "scope" && <ScopeView scopes={scope.scopes} />}
        {view === "keys" && <KeysView fx={fx} kb={keyboard} />}
        <MeterColumn scopes={scope.scopes} status={scope.audio.status} />
      </div>
      {settingsOpen && (
        <SettingsPanel settings={settings} midiInput={midiHits.inputName} scope={scope} fx={fx} onChange={setSettings}
          onClose={() => setSettingsOpen(false)} />
      )}
    </div>
  );
}
