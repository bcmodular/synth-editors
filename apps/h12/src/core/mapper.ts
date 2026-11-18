// The H12's mapper (setting 3): six words that turn a range of messages on some inputs into another message
// (docs/h12-spec.md › Mapper layout). The app uses mappers 18–23 only, leaving 0–17 for manual use.

export const MapperMessage = { noteOn: 0, noteOff: 1, cc: 2, programChange: 3, pitchBend: 4, channelAT: 5 } as const;

export const MAPPER_WORDS = 6;
// Word 3's init flag. Before firmware 5.0 it takes the whole top byte, 5A, and at power-up the H12 resets every
// setting to factory defaults if any mapper lacks it (CME, 2026-11-19). From 5.0 it is 5 in bits 26–24; the app only
// writes the 4.x format, and won't switch targets on 5.0 or later (status.ts mapperFormatProblem).
export const INIT = 0x5a;
const FOLLOW_VALUE_1 = 1 << 1;
const FOLLOW_VALUE_2 = 1 << 2;
// Word 5: USB-C virtual cables 1–8 in bits 0–7, then the MIDI inputs: MIDI In n = bit 16 + 8 cables + n − 1, so
// bit 24 = MIDI In 1 … bit 29 = MIDI In 6 (CME's page from version 1.1; found on the H12 first).
const MIDI_INPUTS = 24;

export interface Range {
  min: number;
  max: number;
}

export const ALL: Range = { min: 0, max: 127 };
export const only = (v: number): Range => ({ min: v, max: v });

export interface MapperSide {
  message: number; // MapperMessage
  channel: number; // 0–15
  value1: Range; // note, controller or program number
  value2: Range; // velocity or controller value
}

export interface MapperSpec {
  input: MapperSide; // input channel min = max = input.channel
  output: MapperSide;
  follow1: boolean; // output value 1 = input value 1
  follow2: boolean;
  midiIn: number; // the TRS MIDI input it works on, 1–6
}

// Word 0 and word 1: value 1 max/min in bits 31–16, value 2 max/min in bits 15–0.
const values = (s: MapperSide) => ((s.value1.max << 24) | (s.value1.min << 16) | (s.value2.max << 8) | s.value2.min) >>> 0;

// Word 2: input message and channel range, output message and channel. Keep original (bit 28) stays clear.
const messages = (m: MapperSpec) =>
  (m.input.message | (m.input.channel << 4) | (m.input.channel << 8) | (m.output.message << 20)
    | (m.output.channel << 24)) >>> 0;

const options = (m: MapperSpec) =>
  ((m.follow1 ? FOLLOW_VALUE_1 : 0) | (m.follow2 ? FOLLOW_VALUE_2 : 0) | (INIT << 24)) >>> 0;

export function mapperWords(m: MapperSpec): number[] {
  return [values(m.input), values(m.output), messages(m), options(m), 0, (1 << (MIDI_INPUTS + m.midiIn - 1)) >>> 0];
}

// Whether a mapper has the init byte firmware 4.x needs at power-up.
export const hasInit = (words: readonly number[]): boolean => words[3]! >>> 24 === INIT;
