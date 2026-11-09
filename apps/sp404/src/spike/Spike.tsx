// Phase 0 spike for the SP-404 MK2: try the serial link and the FX MIDI on the device, capturing the bytes.
// Open it with #spike on the app's URL.

import { MidiPanel } from "./MidiPanel";
import { SerialPanel } from "./SerialPanel";
import { useSerial } from "./useSerial";

export function Spike() {
  const serial = useSerial();
  return (
    <main className="spike">
      <h1>SP-404 MK2 · Phase 0 spike</h1>
      <p className="dim">Capture file: {serial.file ?? "none (not running in Electron)"}</p>
      <MidiPanel note={serial.note} />
      <SerialPanel serial={serial} />
    </main>
  );
}
