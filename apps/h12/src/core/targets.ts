// Targets (docs/h12-spec.md › Target list): the synth the Launchkey and the pedal both play. Each target becomes the
// H12 settings below, which are the only ones target switching touches: the routing of MIDI In 2 (pedal) and
// MIDI In 3 (Launchkey), and mappers 18–23.

import { ALL, hasInit, MapperMessage, mapperWords, only, type MapperSpec } from "./mapper";
import { Setting, type SettingRef } from "./sysex";

export interface Target {
  name: string;
  output: number; // H12 output port index, 0–29
  channel: number; // 1–16, as in the file; 0-based on the wire. With `channels`, the one a plain click picks
  channels?: number[]; // a multitimbral synth's channels to choose from (e.g. the JV-2080's parts)
}

// What the keys and the pedal play: a target, on one of its channels, the CC the pedal sends it, and whether a copy
// goes to the Mac for the monitor.
export interface Choice {
  target: Target;
  channel: number; // 1–16
  pedalCc: number; // 0–127
  monitor: boolean;
}

export interface SwitchOptions {
  channel?: number; // one of the target's channels; its own by default
  pedalCc?: number; // the CC the pedal sends the target; DEFAULT_PEDAL_CC by default
  monitor?: boolean; // also send the keys and the pedal to the Mac
}

// The Mac's copy goes to USB-C virtual cable 8 ("H12MIDI-Pro Port 8"): nothing else routes there, and its output
// has no filters (read on the H12, 2026-11-16).
export const MONITOR_OUT = 23;
export const MONITOR_PORT = "H12MIDI-Pro Port 8";

export const channelsOf = (t: Target): number[] => t.channels ?? [t.channel];

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
const PEDAL_SENDS = 11; // the pedal sends CC 11 on channel 1 (set once in DOREMIDI's tool)
const PEDAL_MAPPER = 23;
export const DEFAULT_PEDAL_CC = 11; // expression, which the JV-2080 follows

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

const value = (ref: SettingRef, words: number[]): SettingValue => {
  const { label } = SWITCH_SETTINGS.find((s) => s.setting === ref.setting && s.index === ref.index)!;
  return { label, setting: ref.setting, index: ref.index, words };
};

// Mappers 18–22, onto a channel (0-based).
const launchkeyMappers = (channel: number): SettingValue[] =>
  LAUNCHKEY_MAPPERS.map(({ index, message }) => value({ setting: Setting.mapper, index }, mapperWords({
    input: { message, channel: 0, value1: ALL, value2: ALL },
    output: { message, channel, value1: ALL, value2: ALL },
    follow1: true, follow2: true, midiIn: LAUNCHKEY_MIDI_IN,
  })));

// Mapper 23: the pedal's CC 11 on channel 1 becomes the given CC on a channel (0-based).
const pedalMapper = (cc: number, channel: number): SettingValue =>
  value({ setting: Setting.mapper, index: PEDAL_MAPPER }, mapperWords({
    input: { message: MapperMessage.cc, channel: 0, value1: only(PEDAL_SENDS), value2: ALL },
    output: { message: MapperMessage.cc, channel, value1: only(cc), value2: ALL },
    follow1: false, follow2: true, midiIn: PEDAL_MIDI_IN,
  }));

// The CC mapper 23 sends now (value 1 of its output, word 1 bits 31–24), if it's the app's pedal mapper: the same
// input match, options and inputs as one the app writes (not the factory mapper or a manual one).
export const pedalCcIn = (current: ReadonlyMap<string, number[]>): number | undefined => {
  const words = current.get(`${Setting.mapper}:${PEDAL_MAPPER}`);
  const ours = pedalMapper(0, 0).words;
  const same = words && [0, 3, 4, 5].every((i) => words[i] === ours[i]);
  return same ? (words[1]! >>> 24) & 0x7f : undefined;
};

// The settings that make a target: both inputs routed to its output only (and to the Mac when monitoring), and the
// mappers onto its channel (the target's own, unless another of its channels is chosen), the pedal's onto the
// pedal CC (one for every target, for now).
export function targetSettings(t: Target, opts: SwitchOptions = {}): SettingValue[] {
  const mac = opts.monitor ? (1 << MONITOR_OUT) >>> 0 : 0;
  const bit = ((1 << t.output) | mac) >>> 0;
  const channel = (opts.channel ?? t.channel) - 1;
  return [
    value({ setting: Setting.routing, index: PEDAL_IN }, [bit]),
    value({ setting: Setting.routing, index: LAUNCHKEY_IN }, [bit]),
    ...launchkeyMappers(channel),
    pedalMapper(opts.pedalCc ?? DEFAULT_PEDAL_CC, channel),
  ];
}

// Off: the keys and the pedal reach nothing, e.g. while REAPER plays a plugin from the Launchkey's own USB port. Only
// the two inputs' routing is written; the mappers stay as they are, ready for the next target.
export const OFF_SETTINGS: SettingValue[] = [
  value({ setting: Setting.routing, index: PEDAL_IN }, [0]),
  value({ setting: Setting.routing, index: LAUNCHKEY_IN }, [0]),
];

export const settingKey = (s: { setting: number; index: number }): string => `${s.setting}:${s.index}`;

export const sameWords = (a: readonly number[] | undefined, b: readonly number[]): boolean =>
  !!a && a.length === b.length && a.every((w, i) => w === b[i]);

const matches = (current: ReadonlyMap<string, number[]>, wanted: SettingValue[]) =>
  wanted.every((s) => sameWords(current.get(settingKey(s)), s.words));

const choicesOf = (target: Target, pedalCc: number): Choice[] =>
  channelsOf(target).flatMap((channel) => [false, true].map((monitor) => ({ target, channel, pedalCc, monitor })));

// The app's mappers that lack firmware 4.x's init byte 5A (written before 2026-11-19): at power-up the H12 would reset
// every setting to factory defaults.
export const mappersWithoutInit = (current: ReadonlyMap<string, number[]>): string[] =>
  SWITCH_SETTINGS.filter((s) => s.setting === Setting.mapper)
    .filter((s) => { const w = current.get(settingKey(s)); return !!w && !hasInit(w); })
    .map((s) => s.label);

// Whether the H12 is set to Off: neither input routed anywhere.
export const isOff = (current: ReadonlyMap<string, number[]>): boolean => matches(current, OFF_SETTINGS);

// The target, channel, pedal CC and monitoring the H12 is set to now, if its settings match one exactly.
export function currentTarget(targets: readonly Target[], current: ReadonlyMap<string, number[]>): Choice | undefined {
  const pedalCc = pedalCcIn(current) ?? DEFAULT_PEDAL_CC;
  return targets.flatMap((t) => choicesOf(t, pedalCc)).find((c) => matches(current, targetSettings(c.target, c)));
}

const isInt = (v: unknown, min: number, max: number): v is number =>
  typeof v === "number" && Number.isInteger(v) && v >= min && v <= max;

function targetProblem(t: Record<string, unknown>, i: number): string | undefined {
  const name = typeof t.name === "string" && t.name ? t.name : undefined;
  const which = name ?? `Target ${i + 1}`;
  if (!name) return `${which}: no name`;
  if (!isInt(t.output, 0, 29)) return `${which}: output must be a port index from 0 to 29`;
  if (!isInt(t.channel, 1, 16)) return `${which}: channel must be from 1 to 16`;
  return channelsProblem(t, which);
}

function channelsProblem({ channels, channel }: Record<string, unknown>, which: string): string | undefined {
  if (channels === undefined) return undefined;
  const ok = Array.isArray(channels) && channels.length > 0 && channels.every((c) => isInt(c, 1, 16));
  if (!ok) return `${which}: channels must be a list of channels from 1 to 16`;
  return channels.includes(channel as number) ? undefined : `${which}: channels must include channel ${String(channel)}`;
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
