// Sync mode per device (docs/h12-spec.md › Sync mode per device): how each synth output follows the Nome II, set
// through the sync bits of its message filter (setting 2, index 30 + output). A set bit blocks the message. Only the
// sync bits are ever changed; every other bit of the filter is kept as the H12 has it.
//
// The Nome II's input (MIDI In 1, index 24) blocks Start/Stop at first, so nothing reaches the outputs' filters. The
// one-off change clears those bits on input 24, and only once every output is External or Free, so nothing starts.

import { Setting } from "./sysex";

const SONG_POSITION = 1 << 9;
const CLOCK = 1 << 12;
const START = 1 << 13;
const CONTINUE = 1 << 14;
const STOP = 1 << 15;

export const TRANSPORT = (SONG_POSITION | START | CONTINUE | STOP) >>> 0;
export const SYNC_MASK = (TRANSPORT | CLOCK) >>> 0;

export type SyncMode = "own" | "external" | "free";

export const MODES: { mode: SyncMode; label: string; hint: string }[] = [
  { mode: "own", label: "Own sequencer", hint: "clock and Start/Stop: its sequencer runs with the Nome II" },
  { mode: "external", label: "External", hint: "clock only: played from the OXI, Ableton or the keys" },
  { mode: "free", label: "Free", hint: "nothing from the Nome II: its own tempo" },
];

// The sync bits each mode blocks.
const BLOCKED: Record<SyncMode, number> = { own: 0, external: TRANSPORT, free: SYNC_MASK };

export interface SyncDevice {
  name: string;
  output: number; // H12 output port index
  modes: readonly SyncMode[];
}

const ALL_MODES: readonly SyncMode[] = ["own", "external", "free"];

export const SYNC_DEVICES: readonly SyncDevice[] = [
  { name: "TB-3", output: 0, modes: ALL_MODES },
  { name: "JV-2080", output: 1, modes: ["external", "free"] }, // no sequencer
  { name: "TR-8S", output: 2, modes: ALL_MODES },
  { name: "Thru5: TD-3-MO, Volca Bass, Volca Kick, iPad, TC M300", output: 24, modes: ALL_MODES },
  { name: "S-1", output: 26, modes: ALL_MODES },
  { name: "SP-404 Mk2", output: 28, modes: ALL_MODES },
  { name: "P-6", output: 29, modes: ALL_MODES },
];

export const NOME_IN = 24; // MIDI In 1: the Nome II
const OUTPUT_FILTERS = 30;

export const filterIndex = (d: SyncDevice): number => OUTPUT_FILTERS + d.output;

// An allowed setting with the bits that may change; the switcher refuses a write that changes any other bit.
export interface MaskedSetting {
  label: string;
  setting: number;
  index: number;
  words: 1;
  mask: number;
}

const nomeLabel = "Message filter of MIDI In 1 (Nome II)";

// Every setting sync modes may write: the sync bits of the devices' output filters, and Start/Stop/Song Position on
// the Nome II's input (never its clock bit).
export const SYNC_SETTINGS: readonly MaskedSetting[] = [
  ...SYNC_DEVICES.map((d) => ({ label: `Message filter of ${d.name}`, setting: Setting.messageFilter,
    index: filterIndex(d), words: 1 as const, mask: SYNC_MASK })),
  { label: nomeLabel, setting: Setting.messageFilter, index: NOME_IN, words: 1, mask: TRANSPORT },
];

// A device's mode as its filter has it, or "custom" for a mix the app doesn't write (e.g. clock blocked, Start not).
export function modeOf(word: number): SyncMode | "custom" {
  const bits = (word & SYNC_MASK) >>> 0;
  return (Object.keys(BLOCKED) as SyncMode[]).find((m) => BLOCKED[m] === bits) ?? "custom";
}

export const withMode = (word: number, mode: SyncMode): number => ((word & ~SYNC_MASK) | BLOCKED[mode]) >>> 0;

// Whether Start/Stop gets past the Nome II's input to the outputs' filters.
export const nomeTransportOpen = (word: number): boolean => (word & TRANSPORT) === 0;

export const nomeWithTransport = (word: number, open: boolean): number =>
  (open ? word & ~TRANSPORT : word | TRANSPORT) >>> 0;

export interface SyncValue {
  label: string;
  setting: number;
  index: number;
  words: number[];
}

type Current = ReadonlyMap<string, number[]>;

const key = (index: number) => `${Setting.messageFilter}:${index}`;
const wordAt = (current: Current, index: number): number | undefined => current.get(key(index))?.[0];

const value = (index: number, word: number): SyncValue => {
  const s = SYNC_SETTINGS.find((x) => x.index === index)!;
  return { label: s.label, setting: s.setting, index, words: [word] };
};

export interface SyncState {
  devices: { device: SyncDevice; mode: SyncMode | "custom" }[];
  nomeOpen: boolean;
}

// What the H12 has now, or undefined if a filter wasn't read.
export function syncState(current: Current): SyncState | undefined {
  const nome = wordAt(current, NOME_IN);
  const words = SYNC_DEVICES.map((d) => wordAt(current, filterIndex(d)));
  if (nome === undefined || words.some((w) => w === undefined)) return undefined;
  return { devices: SYNC_DEVICES.map((device, i) => ({ device, mode: modeOf(words[i]!) })), nomeOpen: nomeTransportOpen(nome) };
}

export type Plan = { ok: SyncValue[] } | { problem: string };

// A plan as useWriter takes it: the settings, or why not.
export const planned = (p: Plan): SyncValue[] | string => ("problem" in p ? p.problem : p.ok);

// One device to a mode, keeping its other filter bits.
export function setMode(current: Current, device: SyncDevice, mode: SyncMode): Plan {
  if (!device.modes.includes(mode)) return { problem: `${device.name} has no ${mode} mode` };
  const word = wordAt(current, filterIndex(device));
  if (word === undefined) return { problem: `${device.name}: its message filter wasn't read` };
  return { ok: [value(filterIndex(device), withMode(word, mode))] };
}

// Every device to External: the safe state before the Nome II's input lets Start/Stop through.
export function allExternal(current: Current): Plan {
  const plans = SYNC_DEVICES.map((d) => setMode(current, d, "external"));
  const bad = plans.find((p) => "problem" in p);
  if (bad) return bad;
  return { ok: plans.flatMap((p) => ("ok" in p ? p.ok : [])) };
}

// Lets Start/Stop through the Nome II's input (only when nothing would start), or blocks it again.
export function setNomeTransport(current: Current, open: boolean): Plan {
  const word = wordAt(current, NOME_IN);
  const state = syncState(current);
  if (word === undefined || !state) return { problem: "The message filters weren't read" };
  const starts = state.devices.filter((d) => d.mode === "own" || d.mode === "custom").map((d) => d.device.name);
  if (open && starts.length) return { problem: `Set these to External or Free first, so nothing starts: ${starts.join(", ")}` };
  return { ok: [value(NOME_IN, nomeWithTransport(word, open))] };
}
