// The SP-404 MK2 editor window (Layout D): top bar, the FX row (Phase 3) and the pad mixer, drawn at
// 1920 × 1080 and zoomed to fit.

import { useMemo, useState } from "react";
import { FxRow } from "./fx/FxRow";
import { useFx } from "./fx/useFx";
import { bankOf } from "./mixer/banks";
import { Desk } from "./mixer/Desk";
import { MixerSide } from "./mixer/MixerSide";
import { useDevice, type Device } from "./mixer/useDevice";
import { useMixer } from "./mixer/useMixer";
import type { HitCounts } from "./mixer/padHits";
import { usePadHits } from "./mixer/usePadHits";
import { useShownBanks } from "./mixer/useShownBanks";
import { SettingsPanel } from "./settings/SettingsPanel";
import { useSettings } from "./settings/useSettings";
import { useFitZoom } from "./ui/useFitZoom";

interface TopBarProps {
  device: Device;
  midiInput?: string;
  midiOutput?: string;
  onSettings: () => void;
}

function TopBar({ device, midiInput, midiOutput, onSettings }: TopBarProps) {
  const { link, device: d, error, connect } = device;
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
      <span className="pill">LAUNCHPAD</span>
      {error && <span className="error" role="alert">{error}</span>}
      <span className="sp" />
      <button className="pill" onClick={onSettings}>SETTINGS</button>
    </div>
  );
}

function projectLabel({ device: d, link }: Device): string {
  if (link !== "on") return "Not connected";
  if (d.loading) return "Reading pads…";
  const number = String((d.project ?? 0) + 1).padStart(2, "0");
  return d.projectName ? `${number} · ${d.projectName}` : number;
}

// Pad hits come from the SP-404's MIDI notes; without its MIDI input, from what the status poll saw.
function serialHits(hit: { pad: number; seq: number } | undefined): HitCounts {
  return hit ? { [hit.pad]: hit.seq } : {};
}

export function Editor() {
  const [root, setRoot] = useState<HTMLDivElement | null>(null);
  useFitZoom(root);
  const device = useDevice();
  const mixer = useMixer(device);
  const loadedBanks = useMemo(() => new Set(mixer.pads.map((p) => bankOf(p.pad))), [mixer.pads]);
  const banks = useShownBanks(device.device.project, loadedBanks);
  const fx = useFx();
  const [settings, setSettings] = useSettings();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const midiHits = usePadHits(settings.padMidi);
  const hits = midiHits.inputName ? midiHits.hits : serialHits(device.device.hit);
  return (
    <div className="ld" ref={setRoot}>
      <TopBar device={device} midiInput={midiHits.inputName} midiOutput={fx.outputName}
        onSettings={() => setSettingsOpen(true)} />
      <FxRow fx={fx} />
      <div className="mixer">
        <MixerSide projectLabel={projectLabel(device)} shown={banks.shown} loadedBanks={loadedBanks}
          onToggleBank={banks.toggle} />
        <Desk mixer={mixer} banks={banks.list} midi={settings.padMidi} hits={hits} />
      </div>
      {settingsOpen && (
        <SettingsPanel settings={settings} midiInput={midiHits.inputName} onChange={setSettings}
          onClose={() => setSettingsOpen(false)} />
      )}
    </div>
  );
}
