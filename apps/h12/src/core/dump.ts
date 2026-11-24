// A read-only dump of the H12's preset (docs/h12-spec.md › Nice to have › Dump): every routing, channel filter,
// message filter and mapper, as JSON to keep in version control, and a check of the rig's rules against it. Only
// reads: nothing here writes.

import { answerBytes } from "./hub";
import { portName } from "./ports";
import { ask } from "./link";
import { decodeInt16, decodeWord, readSetting, Setting, WORD_BYTES } from "./sysex";
import { NOME_IN, SYNC_DEVICES } from "./sync";
import type { Io } from "./switcher";

const CHANNEL_FILTER = 0x01;
const INPUTS = 30;
const PORTS = 60; // filters: 0–29 inputs, 30–59 outputs
const MAPPERS = 24;
const PAYLOAD = 10;

export interface Dump {
  savedAt: string; // ISO date
  firmware?: string;
  serial?: string;
  routing: number[]; // by input 0–29: bit n = output n
  channelFilters: number[]; // 0–29 inputs, 30–59 outputs: bit n = channel n + 1 blocked
  messageFilters: number[]; // same indices: bit set = message blocked
  mappers: number[][]; // 0–23, six words each
}

// The values of an answer: a channel filter is an Int16 (3 bytes), everything else 32-bit words.
export function payloadValues(bytes: readonly number[]): number[] {
  const payload = bytes.length - PAYLOAD - 2;
  if (payload === 3) return [decodeInt16(bytes, PAYLOAD)];
  return Array.from({ length: Math.floor(payload / WORD_BYTES) }, (_, i) => decodeWord(bytes, PAYLOAD + i * WORD_BYTES));
}

const range = (n: number) => Array.from({ length: n }, (_, i) => i);

interface Part {
  setting: number;
  count: number; // indices 0…count − 1
  words: number;
  label: string;
}

async function readAll(io: Io, { setting, count, words, label }: Part): Promise<number[][]> {
  const out: number[][] = [];
  for (const index of range(count)) {
    const got = answerBytes(`${label} ${index}`, await ask(io.lane, io.listen, readSetting({ setting, index }, words)));
    if ("problem" in got) throw new Error(got.problem);
    out.push(payloadValues(got.bytes));
  }
  return out;
}

// Reads the whole preset, one setting at a time. Throws at the first setting that doesn't read.
export async function readDump(io: Io, about: { firmware?: string; serial?: string }, now = new Date()): Promise<Dump> {
  const first = (v: number[][]) => v.map((w) => w[0] ?? 0);
  return {
    savedAt: now.toISOString(), ...about,
    routing: first(await readAll(io, { setting: Setting.routing, count: INPUTS, words: 1, label: "Routing of input" })),
    channelFilters: first(await readAll(io, { setting: CHANNEL_FILTER, count: PORTS, words: 1, label: "Channel filter" })),
    messageFilters: first(await readAll(io, { setting: Setting.messageFilter, count: PORTS, words: 1,
      label: "Message filter" })),
    mappers: await readAll(io, { setting: Setting.mapper, count: MAPPERS, words: 6, label: "Mapper" }),
  };
}

const hex = (w: number, digits = 8) => w.toString(16).toUpperCase().padStart(digits, "0");

// The dump as JSON, with values in hex so it reads like HxMIDI Tools and diffs cleanly.
export function dumpJson(d: Dump): string {
  const words = (v: number[]) => v.map((w) => hex(w));
  return JSON.stringify({ ...d, routing: words(d.routing), channelFilters: d.channelFilters.map((w) => hex(w, 4)),
    messageFilters: words(d.messageFilters), mappers: d.mappers.map(words) }, null, 2);
}

export interface RuleCheck {
  rule: string;
  ok: boolean;
  detail?: string;
}

const CLOCK_BIT = 1 << 12;
const CH13_14 = (1 << 12) | (1 << 13);
const OXI_OUT = 3;
const ONLY_CH14 = 0xffff & ~(1 << 13);
const OUTPUT_FILTERS = 30;

// The rig's rules (docs/h12-spec.md › Rule check): clock only from MIDI In 1; channels 13–14 (the OXI's) blocked on
// every synth output; only channel 14 reaching the OXI.
export function checkRules(d: Dump): RuleCheck[] {
  const clockFrom = range(INPUTS).filter((i) => i !== NOME_IN && d.routing[i] && !(d.messageFilters[i]! & CLOCK_BIT));
  const open = SYNC_DEVICES.filter((s) => (d.channelFilters[OUTPUT_FILTERS + s.output]! & CH13_14) !== CH13_14);
  const oxi = d.channelFilters[OUTPUT_FILTERS + OXI_OUT]!;
  return [
    { rule: "Clock comes only from MIDI In 1 (the Nome II)", ok: clockFrom.length === 0,
      detail: clockFrom.length ? `Routed inputs that let clock through: ${clockFrom.map((i) => portName(i, "In")).join(", ")}` : undefined },
    { rule: "Channels 13–14 are blocked on every synth output", ok: open.length === 0,
      detail: open.length ? `Not blocked on: ${open.map((s) => s.name).join(", ")}` : undefined },
    { rule: "Only channel 14 reaches the OXI", ok: oxi === ONLY_CH14,
      detail: oxi === ONLY_CH14 ? undefined : `The OXI's output channel filter is ${hex(oxi, 4)}, not DFFF` },
  ];
}
