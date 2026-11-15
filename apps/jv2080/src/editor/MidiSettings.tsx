// The MIDI button at the end of the top strip and its pop-up: the JV's device ID (for SysEx) and the patch channel
// (for bank select and program change). Both are remembered.

import { useRef, useState } from "react";
import type { JvLink } from "../link/useJvLink";
import { useDismiss } from "../ui/useDismiss";

const SIXTEEN = Array.from({ length: 16 }, (_, i) => i);
const FIRST_DEVICE_ID = 0x10; // shown as 17 on the JV

function MidiPanel({ link, onClose }: { link: JvLink; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useDismiss(ref, onClose);
  return (
    <div ref={ref} className="midi-pop">
      <label className="prow">
        <span className="lbl">Device ID</span>
        <select className="pick" value={link.device} onChange={(e) => link.setDevice(Number(e.target.value))}>
          {SIXTEEN.map((i) => <option key={i} value={FIRST_DEVICE_ID + i}>{17 + i}</option>)}
        </select>
      </label>
      <label className="prow">
        <span className="lbl">Patch channel</span>
        <select className="pick" value={link.channel} onChange={(e) => link.setChannel(Number(e.target.value))}>
          {SIXTEEN.map((i) => <option key={i} value={i}>{i + 1}</option>)}
        </select>
      </label>
      <p className="note">
        These match SYSTEM › MIDI on the JV. It ignores SysEx unless Rx Sys Excl is ON, and in GM mode.
      </p>
    </div>
  );
}

export function MidiSettings({ link }: { link: JvLink }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="midi-set">
      <button className={`btn ${open ? "sel" : ""}`} onClick={() => setOpen((o) => !o)}>MIDI ▾</button>
      {open && <MidiPanel link={link} onClose={() => setOpen(false)} />}
    </div>
  );
}
