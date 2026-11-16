// Target switching over the H12 link (core/switcher.ts): reads which target the H12 is set to, switches to another,
// turns the copy to the Mac (for the monitor) on and off, and puts back the H12's previous settings. Before the first
// write, the previous values of every setting a switch may change are kept (core/backup.ts), once.

import { useCallback, useEffect, useState } from "react";
import { backupOf, parseBackup, type Backup } from "../core/backup";
import { applySettings, readSwitchSettings, type ApplyReport, type Current, type Io } from "../core/switcher";
import { currentTarget, parseTargets, targetSettings, type Choice, type SettingValue, type Target } from "../core/targets";
import list from "../targets.json";
import type { HubState } from "../hub/useHub";

const BACKUP_KEY = "h12.backup";
const PARSED = parseTargets(list);

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

const switchWording = (name: string): Wording => ({ doing: `Switching to ${name}`, done: `Switched to ${name}`,
  stopped: `Stopped switching to ${name}`, unchanged: `Already on ${name}` });

const RESTORE: Wording = { doing: "Putting back the previous settings", done: "Put back the previous settings",
  stopped: "Stopped putting back the previous settings", unchanged: "The previous settings are already there" };

const monitorWording = (on: boolean): Wording => {
  const what = `the copy to the Mac ${on ? "on" : "off"}`;
  return { doing: `Turning ${what}`, done: `Turned ${what}`, stopped: `Stopped turning ${what}`,
    unchanged: `The copy to the Mac is already ${on ? "on" : "off"}` };
};

const nameOf = (c: Pick<Choice, "target" | "channel">) =>
  (c.target.channels ? `${c.target.name} ch ${c.channel}` : c.target.name);

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

type Apply = (wording: Wording, wanted: (current: Current) => SettingValue[]) => Promise<void>;

// What the panel can do: switch target (keeping the copy to the Mac as it is), turn the copy on or off, restore.
function useActions(apply: Apply, active: Choice | undefined, backup: Backup | undefined) {
  const monitor = active?.monitor ?? false;
  const switchTo = useCallback((target: Target, channel = target.channel) =>
    apply(switchWording(nameOf({ target, channel })), () => targetSettings(target, { channel, monitor })),
  [apply, monitor]);
  const setMonitor = useCallback((on: boolean) => {
    if (!active) return;
    void apply(monitorWording(on), () => targetSettings(active.target, { channel: active.channel, monitor: on }));
  }, [apply, active]);
  const restore = useCallback(() => {
    if (backup) void apply(RESTORE, () => backup.settings);
  }, [apply, backup]);
  return { switchTo, setMonitor, restore };
}

export function useTargets(hub: HubState) {
  const io = hub.kind === "ready" ? hub.io : undefined;
  const { current, setCurrent, readProblem } = useCurrent(io);
  const [busy, setBusy] = useState<string>();
  const [outcome, setOutcome] = useState<Outcome>();
  const [backup, setBackup] = useState(loadBackup);

  const apply = useCallback(async (wording: Wording, wanted: (current: Current) => SettingValue[]) => {
    if (!io) return;
    setBusy(wording.doing);
    const { report, after } = await run(io, wanted);
    if (after) setCurrent(after);
    setBackup(loadBackup());
    setOutcome({ wording, report });
    setBusy(undefined);
  }, [io, setCurrent]);

  const active = current ? currentTarget(TARGETS, current) : undefined;
  const actions = useActions(apply, active, backup);
  return {
    targets: TARGETS, listProblems: LIST_PROBLEMS, ready: !!current && !!io, active, readProblem, busy, outcome,
    backup, ...actions,
  };
}

export type Targets = ReturnType<typeof useTargets>;
