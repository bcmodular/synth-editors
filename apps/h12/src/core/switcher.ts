// Writing to the H12: targets (docs/h12-spec.md › What setTarget does) and sync modes (› Sync mode per device). The
// rules, from the spec and CLAUDE.md:
// - write only the settings in an allowed list, and only in preset 1: SWITCH_SETTINGS for targets (routing of inputs
//   25 and 26, mappers 18–23), SYNC_SETTINGS for sync modes (message filters, and only their sync bits: a write
//   that changes any other bit is refused);
// - skip a setting that already has the wanted value (every write wears the H12's flash);
// - read every written setting back, and stop at the first problem: an error answer, no answer, a bad checksum or a
//   value that reads back differently.

import { answerBytes } from "./hub";
import { ask, type Lane, type Listen } from "./link";
import { hasInit } from "./mapper";
import { presetOf } from "./status";
import type { MaskedSetting } from "./sync";
import { readSetting, Setting, settingWords, writeSetting } from "./sysex";
import { sameWords, settingKey, SWITCH_SETTINGS, type SettingValue } from "./targets";

export interface Io {
  lane: Lane;
  listen: Listen;
}

type Got<T> = { ok: T } | { problem: string };

interface Wanted {
  label: string;
  setting: number;
  index: number;
  count: number; // words
}

const hexWords = (words: readonly number[]) => words.map((w) => w.toString(16).toUpperCase().padStart(8, "0")).join(" ");

async function readWords(io: Io, w: Wanted): Promise<Got<number[]>> {
  const reply = await ask(io.lane, io.listen, readSetting(w, w.count));
  const got = answerBytes(w.label, reply);
  if ("problem" in got) return got;
  const words = settingWords(got.bytes);
  return words?.length === w.count ? { ok: words } : { problem: `${w.label}: an answer the app can't read` };
}

export type Current = Map<string, number[]>;

// A setting the app may write; with a mask, only those bits may change.
export type Allowed = { label: string; setting: number; index: number; words: number; mask?: number };

// Reads every setting in a list, so a write can skip what already matches and the backup can keep them.
export async function readSettings(io: Io, list: readonly Allowed[]): Promise<Got<Current>> {
  const current: Current = new Map();
  for (const s of list) {
    const got = await readWords(io, { label: s.label, setting: s.setting, index: s.index, count: s.words });
    if ("problem" in got) return got;
    current.set(settingKey(s), got.ok);
  }
  return { ok: current };
}

export const readSwitchSettings = (io: Io): Promise<Got<Current>> => readSettings(io, SWITCH_SETTINGS);

async function presetProblem(io: Io): Promise<string | undefined> {
  const got = await readWords(io, { label: "Current preset", setting: Setting.currentPreset, index: 0, count: 1 });
  if ("problem" in got) return got.problem;
  const preset = presetOf(got.ok[0]!).index;
  return preset === 0 ? undefined : `The H12 is on preset ${preset + 1}: switch it to preset 1 first`;
}

// Refuses anything outside the allowed list (the spec lists the only settings the app may change), and for a masked
// setting, any change outside its mask.
function assertAllowed(v: SettingValue, list: readonly Allowed[], current: Current): void {
  const allowed = list.find((s) => s.setting === v.setting && s.index === v.index);
  if (!allowed || allowed.words !== v.words.length) throw new Error(`Not a setting the app may write: ${v.setting}:${v.index}`);
  if (allowed.mask !== undefined) assertInMask(v, allowed.mask, current.get(settingKey(v)));
}

// A masked setting must have been read, and may differ from it only within the mask.
function assertInMask(v: SettingValue, mask: number, now: number[] | undefined): void {
  const outside = !now || v.words.some((w, i) => ((w ^ now[i]!) & ~mask) !== 0);
  if (outside) throw new Error(`${v.label}: only bits ${hexWords([mask])} may change`);
}

async function writeAndCheck(io: Io, v: SettingValue): Promise<string | undefined> {
  const ack = answerBytes(`Writing ${v.label}`, await ask(io.lane, io.listen, writeSetting(v, v.words)));
  if ("problem" in ack) return ack.problem;
  const back = await readWords(io, { label: `Reading back ${v.label}`, setting: v.setting, index: v.index,
    count: v.words.length });
  if ("problem" in back) return back.problem;
  if (sameWords(back.ok, v.words)) return undefined;
  return `${v.label}: wrote ${hexWords(v.words)} but read back ${hexWords(back.ok)}`;
}

export interface ApplyReport {
  written: string[]; // labels, in order
  skipped: string[]; // already had the wanted value
  problem?: string; // the first one; nothing after it was written
}

// On firmware 4.x, a mapper without 5A in word 3's top byte makes the H12 reset every setting at power-up.
function initProblem(wanted: SettingValue[]): string | undefined {
  const bad = wanted.find((v) => v.setting === Setting.mapper && !hasInit(v.words));
  return bad && `${bad.label}: ${hexWords(bad.words)} lacks the init byte 5A, which would reset the H12 at power-up`;
}

// Writes the settings that differ from `current` (read just before), each read back before the next. `allowed` is
// the list they must come from: SWITCH_SETTINGS unless given.
export async function applySettings(io: Io, wanted: SettingValue[], current: Current,
  allowed: readonly (Allowed | MaskedSetting)[] = SWITCH_SETTINGS): Promise<ApplyReport> {
  wanted.forEach((v) => assertAllowed(v, allowed, current));
  const report: ApplyReport = { written: [], skipped: [], problem: initProblem(wanted) };
  if (report.problem) return report;
  const changes = wanted.filter((v) => !sameWords(current.get(settingKey(v)), v.words));
  report.skipped = wanted.filter((v) => !changes.includes(v)).map((v) => v.label);
  if (changes.length === 0) return report;
  report.problem = await presetProblem(io);
  for (const v of changes) {
    if (report.problem) break;
    report.problem = await writeAndCheck(io, v);
    if (!report.problem) report.written.push(v.label);
  }
  return report;
}
