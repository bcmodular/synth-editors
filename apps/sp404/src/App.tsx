// Phase 0 spike for the SP-404 MK2: try the serial link and the FX MIDI on the device, capturing the bytes.

import { MidiPanel } from "./spike/MidiPanel";
import { SerialPanel } from "./spike/SerialPanel";
import { useSerial } from "./spike/useSerial";

export function App() {
  const serial = useSerial();
  return (
    <main>
      <h1>SP-404 MK2 · Phase 0 spike</h1>
      <p className="dim">Capture file: {serial.file ?? "none (not running in Electron)"}</p>
      <MidiPanel note={serial.note} />
      <SerialPanel serial={serial} />
    </main>
  );
}
