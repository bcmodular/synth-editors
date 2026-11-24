// What target switching and sync modes share: reading a list of settings whenever the H12's link (re)appears, and
// writing changes through core/switcher.ts with a backup kept before the first write. Every exchange with the H12
// goes through one queue, so the two panels never interleave their requests.

import { useCallback, useEffect, useState } from "react";
import { backupOf, parseBackup, type Backup } from "../core/backup";
import { applySettings, readSettings, type Allowed, type ApplyReport, type Current, type Io } from "../core/switcher";
import type { HubReport } from "../core/hub";
import type { SettingValue } from "../core/targets";
import type { HubState } from "../hub/useHub";

let queue: Promise<unknown> = Promise.resolve();

// Runs fn after every exchange queued before it.
export function serial<T>(fn: () => Promise<T>): Promise<T> {
  const next = queue.then(fn, fn);
  queue = next.catch(() => undefined);
  return next;
}

// How a change is reported: when it's done, when it stopped part way, and when there was nothing to write.
export interface Wording {
  doing: string; // "Switching to TB-3"
  done: string; // "Switched to TB-3"
  stopped: string; // "Stopped switching to TB-3"
  unchanged: string; // "Already on TB-3"
}

export interface Outcome {
  wording: Wording;
  report: ApplyReport;
}

const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? "" : "s"}`;

// "Switched to TB-3: wrote 7 settings, 1 already matched."
export function summary({ wording, report: r }: Outcome): string {
  if (r.written.length === 0 && !r.problem) return `${wording.unchanged}: nothing written.`;
  const done = `wrote ${plural(r.written.length, "setting")}`;
  const same = r.skipped.length ? `, ${r.skipped.length} already matched` : "";
  return r.problem ? `${wording.stopped} (${done}${same}).` : `${wording.done}: ${done}${same}.`;
}

const refused = (problem: string): ApplyReport => ({ written: [], skipped: [], problem });

// Something that went wrong in the app itself, reported like a problem from the H12 so the buttons come back.
const failed = (e: unknown): { report: ApplyReport } =>
  ({ report: refused(`The app failed: ${e instanceof Error ? e.message : String(e)}`) });

// The settings to write, worked out from what the H12 has now, or why not.
export type Wanted = (current: Current) => SettingValue[] | string;

export interface WriterSpec {
  list: readonly Allowed[]; // what may be written, read before and after
  backupKey: string; // local storage key of this list's backup
  guard?: (hub: HubReport) => string | undefined; // a reason not to write at all
}

function loadBackup(spec: WriterSpec): Backup | undefined {
  try {
    return parseBackup(JSON.parse(localStorage.getItem(spec.backupKey) ?? "null"), spec.list);
  } catch {
    return undefined;
  }
}

function keepBackup(spec: WriterSpec, current: Current): void {
  if (loadBackup(spec)) return;
  localStorage.setItem(spec.backupKey, JSON.stringify(backupOf(current, new Date(), spec.list)));
}

// Reads, keeps the backup if there's none yet, writes what differs, and reads again to show the result.
async function run(io: Io, hub: HubReport, spec: WriterSpec, wanted: Wanted):
Promise<{ report: ApplyReport; after?: Current }> {
  const guard = spec.guard?.(hub);
  if (guard) return { report: refused(guard) };
  const before = await readSettings(io, spec.list);
  if ("problem" in before) return { report: refused(before.problem) };
  const want = wanted(before.ok);
  if (typeof want === "string") return { report: refused(want) };
  keepBackup(spec, before.ok);
  const report = await applySettings(io, want, before.ok, spec.list);
  const after = await readSettings(io, spec.list);
  return { report, after: "ok" in after ? after.ok : undefined };
}

// The list's settings as the H12 has them, read whenever the link (re)appears.
function useCurrent(io: Io | undefined, list: readonly Allowed[]) {
  const [current, setCurrent] = useState<Current>();
  const [readProblem, setReadProblem] = useState<string>();
  useEffect(() => {
    setCurrent(undefined);
    if (!io) return;
    let cancelled = false;
    void serial(() => readSettings(io, list)).then((got) => {
      if (cancelled) return;
      setCurrent("ok" in got ? got.ok : undefined);
      setReadProblem("problem" in got ? got.problem : undefined);
    });
    return () => {
      cancelled = true;
    };
  }, [io, list]);
  return { current, setCurrent, readProblem };
}

// `note` puts each outcome in the MIDI monitor's log, so it can be read against what the H12 sends.
export function useWriter(hub: HubState, spec: WriterSpec, note: (text: string) => void) {
  const link = hub.kind === "ready" ? hub : undefined;
  const { current, setCurrent, readProblem } = useCurrent(link?.io, spec.list);
  const [busy, setBusy] = useState<string>();
  const [outcome, setOutcome] = useState<Outcome>();
  const [backup, setBackup] = useState(() => loadBackup(spec));

  const apply = useCallback(async (wording: Wording, wanted: Wanted) => {
    if (!link) return;
    setBusy(wording.doing);
    const done = await serial(() => run(link.io, link.report, spec, wanted)).catch(failed);
    if ("after" in done && done.after) setCurrent(done.after);
    setBackup(loadBackup(spec));
    const result = { wording, report: done.report };
    setOutcome(result);
    note([summary(result), done.report.problem].filter(Boolean).join(" "));
    setBusy(undefined);
  }, [link, spec, setCurrent, note]);

  const restore = useCallback(() => {
    if (backup) void apply(restoreWording, () => backup.settings);
  }, [apply, backup]);

  return { current, ready: !!current && !!link, readProblem, busy, outcome, backup, apply, restore };
}

const restoreWording: Wording = { doing: "Putting back the previous settings", done: "Put back the previous settings",
  stopped: "Stopped putting back the previous settings", unchanged: "The previous settings are already there" };
