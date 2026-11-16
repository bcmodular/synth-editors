// The firmware in the top bar: the version the SP-404 reports, and a warning (until accepted) when it isn't the one
// the USB serial protocol was worked out on.

import { TESTED_VERSION } from "../core/firmware";
import type { Firmware } from "./useFirmware";

const UNTESTED_TIP = `The editor's USB link (pads, levels, names) was worked out on firmware ${TESTED_VERSION}. Another `
  + "firmware may change it: if the desk shows wrong values or edits don't land, stop using the USB link. The FX "
  + "(over MIDI) aren't affected. Click to stop warning about this version.";

export function FirmwarePill({ firmware }: { firmware: Firmware }) {
  const s = firmware.state;
  if (s.kind === "off" || s.kind === "asking") return null;
  if (s.kind === "silent") {
    return <span className="pill" title="The SP-404 didn't say which firmware it runs">FW ?</span>;
  }
  if (s.kind === "untested") {
    return (
      <button className="pill fw-warn" role="alert" title={UNTESTED_TIP} onClick={() => firmware.accept(s.version)}>
        FW {s.version} · UNTESTED
      </button>
    );
  }
  return <span className="pill on" title={`SP-404 firmware ${s.version}`}>FW {s.version}</span>;
}
