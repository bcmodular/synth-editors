// Settings: how the SP-404 is set up for MIDI, which the app can't read from it. Opens from the top bar.

import { useRef } from "react";
import { noteName, padNote, type MidiMode, type PadMidiSettings } from "../core/padNotes";
import { useDismiss } from "../ui/useDismiss";
import { BASE_CHANNEL_RANGE, NOTE_OFFSET_RANGE, type Settings } from "./useSettings";

export interface SettingsPanelProps {
  settings: Settings;
  midiInput?: string;
  onChange: (s: Settings) => void;
  onClose: () => void;
}

const range = (min: number, max: number) => Array.from({ length: max - min + 1 }, (_, i) => min + i);

// Where bank A's pads land with these settings, as a check against the SP-404's own chart.
function bankASummary(midi: PadMidiSettings): string {
  const low = padNote(12, midi);
  const high = padNote(3, midi);
  if (!low || !high) return "Bank A is out of MIDI range with this offset.";
  return `Bank A: channel ${low.channel}, ${noteName(low.note)} (pad 13) to ${noteName(high.note)} (pad 4).`;
}

function ModeButtons({ mode, onMode }: { mode: MidiMode; onMode: (m: MidiMode) => void }) {
  return (
    <div className="seg" role="group" aria-label="MIDI mode">
      {(["A", "B"] as const).map((m) => (
        <button key={m} className={`btn ${mode === m ? "on" : ""}`} aria-pressed={mode === m} onClick={() => onMode(m)}>
          MODE {m}
        </button>
      ))}
    </div>
  );
}

function ModeBFields({ midi, set }: { midi: PadMidiSettings; set: (p: Partial<PadMidiSettings>) => void }) {
  const disabled = midi.mode !== "B";
  return (
    <>
      <label className="field">
        <span>Pad MIDI Channels</span>
        <select value={midi.baseChannel} disabled={disabled} aria-label="Pad MIDI Channels"
          onChange={(e) => set({ baseChannel: Number(e.target.value) })}>
          {range(BASE_CHANNEL_RANGE.min, BASE_CHANNEL_RANGE.max).map((c) => (
            <option key={c} value={c}>{`CH ${c} (A–E) · CH ${c + 1} (F–J)`}</option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>Note offset</span>
        <select value={midi.noteOffset} disabled={disabled} aria-label="Note offset"
          onChange={(e) => set({ noteOffset: Number(e.target.value) })}>
          {range(NOTE_OFFSET_RANGE.min, NOTE_OFFSET_RANGE.max).map((o) => (
            <option key={o} value={o}>{o > 0 ? `+${o}` : o}</option>
          ))}
        </select>
      </label>
    </>
  );
}

export function SettingsPanel({ settings, midiInput, onChange, onClose }: SettingsPanelProps) {
  const panel = useRef<HTMLDivElement>(null);
  useDismiss(panel, onClose);
  const midi = settings.padMidi;
  const set = (p: Partial<PadMidiSettings>) => onChange({ ...settings, padMidi: { ...midi, ...p } });
  return (
    <div className="settings" ref={panel} role="dialog" aria-label="Settings">
      <div className="ahr-head">
        <span className="h">SETTINGS</span>
        <button className="btn" onClick={onClose} aria-label="Close settings">CLOSE</button>
      </div>
      <div className="lbl">PAD MIDI · set to match the SP-404 (System › MIDI)</div>
      <ModeButtons mode={midi.mode} onMode={(mode) => set({ mode })} />
      <ModeBFields midi={midi} set={set} />
      <div className="note">{bankASummary(midi)}</div>
      <div className="lbl">FX</div>
      <div className="note">
        On BUS 1 and 2, effects 1–5 are the SP-404's Direct FX slots. The app assumes they hold the factory effects
        (Filter + Drive, Resonator, Sync Delay, Isolator, DJFX Looper); if you've reassigned them, choosing those
        effects loads whatever is in the slot.
      </div>
      <div className="lbl">PAD LIGHTS</div>
      <div className="note">
        {midiInput ? `Listening to ${midiInput}.` : "The SP-404's MIDI isn't connected."} The pad lights need SEQ Note
        Out and PAD Note Out set to ON on the SP-404 (System › MIDI).
      </div>
    </div>
  );
}
