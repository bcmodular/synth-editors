// App settings, kept in localStorage. The SP-404 doesn't report its MIDI mode or offsets, so the user sets them
// here to match the device (System > MIDI).

import { useCallback, useState } from "react";
import { DEFAULT_PAD_MIDI, type PadMidiSettings } from "../core/padNotes";

export interface Settings {
  padMidi: PadMidiSettings;
}

const KEY = "sp404.settings";
export const DEFAULT_SETTINGS: Settings = { padMidi: DEFAULT_PAD_MIDI };

export const NOTE_OFFSET_RANGE = { min: -12, max: 36 } as const;
export const BASE_CHANNEL_RANGE = { min: 1, max: 9 } as const;

const clampInt = (v: unknown, min: number, max: number, fallback: number): number =>
  typeof v === "number" && Number.isInteger(v) ? Math.max(min, Math.min(max, v)) : fallback;

// Whatever is stored, a valid Settings comes back (missing or bad values take the defaults).
export function readSettings(raw: string | null): Settings {
  try {
    const stored = (raw ? JSON.parse(raw) : {}) as { padMidi?: Partial<PadMidiSettings> };
    const p = stored.padMidi ?? {};
    const d = DEFAULT_PAD_MIDI;
    return {
      padMidi: {
        mode: p.mode === "A" ? "A" : "B",
        baseChannel: clampInt(p.baseChannel, BASE_CHANNEL_RANGE.min, BASE_CHANNEL_RANGE.max, d.baseChannel),
        noteOffset: clampInt(p.noteOffset, NOTE_OFFSET_RANGE.min, NOTE_OFFSET_RANGE.max, d.noteOffset),
      },
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function useSettings() {
  const [settings, setSettings] = useState<Settings>(() => readSettings(localStorage.getItem(KEY)));
  const update = useCallback((next: Settings) => {
    setSettings(next);
    localStorage.setItem(KEY, JSON.stringify(next));
  }, []);
  return [settings, update] as const;
}
