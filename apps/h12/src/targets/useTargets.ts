// Target switching over the H12 link (core/switcher.ts): reads which target the H12 is set to, switches to another,
// and puts back the H12's previous settings. Before the first write, the previous values of every setting a switch
// may change are kept (core/backup.ts), once.

import { useCallback, useEffect, useState } from "react";
import { backupOf, parseBackup, type Backup } from "../core/backup";
import { applySettings, readSwitchSettings, type ApplyReport, type Current, type Io } from "../core/switcher";
import { currentTarget, parseTargets, targetSettings, type SettingValue, type Target } from "../core/targets";
import list from "../targets.json";
import type { HubState } from "../hub/useHub";

const BACKUP_KEY = "h12.backup";
const PARSED = parseTargets(list);

export interface Outcome {
  what: string; // the target's name, or "the previous settings"
  restore: boolean;
  report: ApplyReport;
}

function loadBackup(): Backup | undefined {
  try {
    return parseBackup(JSON.parse(localStorage.getItem(BACKUP_KEY) ?? "null"));
  } catch {
    return undefined;
  }
}

function keepBackup(current: Current): Backup {
  const kept = loadBackup();
  if (kept) return kept;
  const backup = backupOf(current, new Date());
  localStorage.setItem(BACKUP_KEY, JSON.stringify(backup));
  return backup;
}

// Reads, keeps the backup if there's none yet, writes what differs, and reads again to show the result.
async function run(io: Io, wanted: (current: Current) => SettingValue[]): Promise<{ report: ApplyReport; after?: Current }> {
  const before = await readSwitchSettings(io);
  if ("problem" in before) return { report: { written: [], skipped: [], problem: before.problem } };
  keepBackup(before.ok);
  const report = await applySettings(io, wanted(before.ok), before.ok);
  const after = await readSwitchSettings(io);
  return { report, after: "ok" in after ? after.ok : undefined };
}

const TARGETS = "targets" in PARSED ? PARSED.targets : [];
const LIST_PROBLEMS = "problems" in PARSED ? PARSED.problems : [];

// The switch settings as the H12 has them, read whenever the link (re)appears.
function useCurrent(io: Io | undefined) {
  const [current, setCurrent] = useState<Current>();
  const [readProblem, setReadProblem] = useState<string>();
  useEffect(() => {
    setCurrent(undefined);
    if (!io) return;
    let cancelled = false;
    readSwitchSettings(io).then((got) => {
      if (cancelled) return;
      setCurrent("ok" in got ? got.ok : undefined);
      setReadProblem("problem" in got ? got.problem : undefined);
    });
    return () => {
      cancelled = true;
    };
  }, [io]);
  return { current, setCurrent, readProblem };
}

export function useTargets(hub: HubState) {
  const io = hub.kind === "ready" ? hub.io : undefined;
  const { current, setCurrent, readProblem } = useCurrent(io);
  const [busy, setBusy] = useState<string>();
  const [outcome, setOutcome] = useState<Outcome>();
  const [backup, setBackup] = useState(loadBackup);

  const apply = useCallback(async (what: string, restore: boolean, wanted: (current: Current) => SettingValue[]) => {
    if (!io) return;
    setBusy(what);
    const { report, after } = await run(io, wanted);
    if (after) setCurrent(after);
    setBackup(loadBackup());
    setOutcome({ what, restore, report });
    setBusy(undefined);
  }, [io, setCurrent]);

  const switchTo = useCallback((t: Target) => apply(t.name, false, () => targetSettings(t)), [apply]);
  const restore = useCallback(() => backup && apply("the previous settings", true, () => backup.settings),
    [apply, backup]);

  const active = current ? currentTarget(TARGETS, current) : undefined;
  return {
    targets: TARGETS, listProblems: LIST_PROBLEMS, ready: current !== undefined && io !== undefined, active,
    readProblem, busy, outcome, backup, switchTo, restore,
  };
}

export type Targets = ReturnType<typeof useTargets>;
