// Targets (docs/h12-spec.md › Target list): the synth the Launchkey and the pedal both play. Each target becomes the
// H12 settings below, which are the only ones target switching touches: the routing of MIDI In 2 (pedal) and
// MIDI In 3 (Launchkey), and mappers 18–23.

import { ALL, MapperMessage, mapperWords, only, type MapperSpec } from "./mapper";
import { Setting } from "./sysex";

export interface Target {
  name: string;
  output: number; // H12 output port index, 0–29
  channel: number; // 1–16, as in the file; 0-based on the wire
  pedalCc: number | null; // null: the pedal is routed nowhere
}

// One H12 setting, as a list of words.
export interface SettingValue {
  label: string;
  setting: number;
  index: number;
  words: number[];
}

export const PEDAL_IN = 25; // MIDI In 2: the DOREMIDI pedal converter
export const LAUNCHKEY_IN = 26; // MIDI In 3: the Launchkey 49 Mk4
const PEDAL_MIDI_IN = 2;
const LAUNCHKEY_MIDI_IN = 3;
const PEDAL_CC = 11; // the pedal sends CC 11 on channel 1 (set once in DOREMIDI's tool)
const PEDAL_MAPPER = 23;

// Mappers 18–22: the Launchkey's channel 1 becomes the target's channel, one mapper per message type.
const LAUNCHKEY_MAPPERS = [
  { index: 18, message: MapperMessage.noteOn, label: "Note On" },
  { index: 19, message: MapperMessage.noteOff, label: "Note Off" },
  { index: 20, message: MapperMessage.cc, label: "CC" },
  { index: 21, message: MapperMessage.pitchBend, label: "Pitch Bend" },
  { index: 22, message: MapperMessage.channelAT, label: "Channel AT" },
] as const;

// Every setting a target switch may write, as { setting, index, words }.
export const SWITCH_SETTINGS = [
  { label: "Routing of MIDI In 2 (pedal)", setting: Setting.routing, index: PEDAL_IN, words: 1 },
  { label: "Routing of MIDI In 3 (Launchkey)", setting: Setting.routing, index: LAUNCHKEY_IN, words: 1 },
  ...LAUNCHKEY_MAPPERS.map((m) => ({ label: `Mapper ${m.index} (Launchkey ${m.label})`, setting: Setting.mapper,
    index: m.index, words: 6 })),
  { label: `Mapper ${PEDAL_MAPPER} (pedal)`, setting: Setting.mapper, index: PEDAL_MAPPER, words: 6 },
] as const;

const labelOf = (setting: number, index: number) =>
  SWITCH_SETTINGS.find((s) => s.setting === setting && s.index === index)!.label;

const value = (setting: number, index: number, words: number[]): SettingValue =>
  ({ label: labelOf(setting, index), setting, index, words });

const launchkeyMapper = (message: number, channel: number): MapperSpec => ({
  input: { message, channel: 0, value1: ALL, value2: ALL },
  output: { message, channel, value1: ALL, value2: ALL },
  follow1: true, follow2: true, midiIn: LAUNCHKEY_MIDI_IN,
});

const pedalMapper = (cc: number, channel: number): MapperSpec => ({
  input: { message: MapperMessage.cc, channel: 0, value1: only(PEDAL_CC), value2: ALL },
  output: { message: MapperMessage.cc, channel, value1: only(cc), value2: ALL },
  follow1: false, follow2: true, midiIn: PEDAL_MIDI_IN,
});

// The settings that make a target: both inputs routed to its output only, and the mappers onto its channel. With no
// pedal CC, the pedal's routing is cleared and mapper 23 is left as it is.
export function targetSettings(t: Target): SettingValue[] {
  const bit = (1 << t.output) >>> 0;
  const channel = t.channel - 1;
  const pedal = t.pedalCc === null ? [] : [value(Setting.mapper, PEDAL_MAPPER, mapperWords(pedalMapper(t.pedalCc, channel)))];
  return [
    value(Setting.routing, PEDAL_IN, [t.pedalCc === null ? 0 : bit]),
    value(Setting.routing, LAUNCHKEY_IN, [bit]),
    ...LAUNCHKEY_MAPPERS.map((m) => value(Setting.mapper, m.index, mapperWords(launchkeyMapper(m.message, channel)))),
    ...pedal,
  ];
}

export const settingKey = (s: { setting: number; index: number }): string => `${s.setting}:${s.index}`;

export const sameWords = (a: readonly number[] | undefined, b: readonly number[]): boolean =>
  !!a && a.length === b.length && a.every((w, i) => w === b[i]);

// The target the H12 is set to now, if its settings match one exactly.
export function currentTarget(targets: readonly Target[], current: ReadonlyMap<string, number[]>): Target | undefined {
  return targets.find((t) => targetSettings(t).every((s) => sameWords(current.get(settingKey(s)), s.words)));
}

const isInt = (v: unknown, min: number, max: number): v is number =>
  typeof v === "number" && Number.isInteger(v) && v >= min && v <= max;

function targetProblem(t: Record<string, unknown>, i: number): string | undefined {
  const name = typeof t.name === "string" && t.name ? t.name : undefined;
  const which = name ?? `Target ${i + 1}`;
  if (!name) return `${which}: no name`;
  if (!isInt(t.output, 0, 29)) return `${which}: output must be a port index from 0 to 29`;
  if (!isInt(t.channel, 1, 16)) return `${which}: channel must be from 1 to 16`;
  if (t.pedalCc !== null && !isInt(t.pedalCc, 0, 127)) return `${which}: pedalCc must be null or from 0 to 127`;
  return undefined;
}

// Checks a target list read from JSON. Returns the targets, or every problem with them.
export function parseTargets(json: unknown): { targets: Target[] } | { problems: string[] } {
  if (!Array.isArray(json)) return { problems: ["The target list must be a JSON array"] };
  const list = json.map((t: unknown) => (t && typeof t === "object" ? (t as Record<string, unknown>) : {}));
  const problems = list.map(targetProblem).filter((p): p is string => p !== undefined);
  const names = list.map((t) => t.name);
  const twice = names.filter((n, i) => names.indexOf(n) !== i);
  problems.push(...[...new Set(twice)].map((n) => `${String(n)}: the name is used twice`));
  return problems.length ? { problems } : { targets: list as unknown as Target[] };
}
