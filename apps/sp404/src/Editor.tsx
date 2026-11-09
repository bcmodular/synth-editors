// The SP-404 MK2 editor window (Layout D): top bar, the FX row (Phase 3) and the pad mixer, drawn at
// 1920 × 1080 and zoomed to fit.

import { useMemo, useState } from "react";
import { DEFAULT_PAD_MIDI } from "./core/padNotes";
import { bankOf } from "./mixer/banks";
import { Desk } from "./mixer/Desk";
import { MixerSide } from "./mixer/MixerSide";
import { useDevice, type Device } from "./mixer/useDevice";
import { useMixer } from "./mixer/useMixer";
import type { HitCounts } from "./mixer/padHits";
import { usePadHits } from "./mixer/usePadHits";
import { useShownBanks } from "./mixer/useShownBanks";
import { useFitZoom } from "./ui/useFitZoom";

function TopBar({ device, midiInput }: { device: Device; midiInput?: string }) {
  const { link, device: d, error, connect } = device;
  const project = d.project === undefined ? "" : ` · PROJECT ${String(d.project + 1).padStart(2, "0")}`;
  const usb = link === "on" ? `USB ●${project}` : link === "connecting" ? "USB …" : "USB ○";
  return (
    <div className="bar">
      <span className="logo">SP-404 MK2</span>
      <span className={`pill ${midiInput ? "on" : ""}`} title={midiInput}>{midiInput ? "MIDI ● SP-404" : "MIDI ○"}</span>
      <span className={`pill ${link === "on" ? "on" : ""}`}>{usb}</span>
      {link === "off" && <button className="pill" onClick={connect}>CONNECT USB</button>}
      <span className="pill">LAUNCHPAD</span>
      {error && <span className="error" role="alert">{error}</span>}
      <span className="sp" />
      <span className="pill">SETTINGS</span>
    </div>
  );
}

function projectLabel({ device: d, link }: Device): string {
  if (link !== "on") return "Not connected";
  if (d.loading) return "Reading pads…";
  const number = String((d.project ?? 0) + 1).padStart(2, "0");
  return d.projectName ? `${number} · ${d.projectName}` : number;
}

const MIDI_SETTINGS = DEFAULT_PAD_MIDI; // Settings will set the mode, Pad MIDI Channels and Note offset

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
  const midiHits = usePadHits(MIDI_SETTINGS);
  const hits = midiHits.inputName ? midiHits.hits : serialHits(device.device.hit);
  return (
    <div className="ld" ref={setRoot}>
      <TopBar device={device} midiInput={midiHits.inputName} />
      <div className="fxrow"><span className="placeholder">FX buses arrive in Phase 3</span></div>
      <div className="mixer">
        <MixerSide projectLabel={projectLabel(device)} shown={banks.shown} loadedBanks={loadedBanks}
          onToggleBank={banks.toggle} />
        <Desk mixer={mixer} banks={banks.list} midi={MIDI_SETTINGS} hits={hits} />
      </div>
    </div>
  );
}
