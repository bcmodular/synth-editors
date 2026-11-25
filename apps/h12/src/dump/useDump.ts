// The read-only dump (core/dump.ts): reads the whole preset when asked, checks the rig's rules against it, and saves
// it as JSON. Its reads go through the same queue as the panels' writes.

import { useCallback, useState } from "react";
import { checkRules, dumpJson, readDump, type Dump, type RuleCheck } from "../core/dump";
import type { HubState } from "../hub/useHub";
import { serial } from "../settings/useWriter";

export function useDump(hub: HubState) {
  const link = hub.kind === "ready" ? hub : undefined;
  const [dump, setDump] = useState<Dump>();
  const [rules, setRules] = useState<RuleCheck[]>([]);
  const [reading, setReading] = useState(false);
  const [problem, setProblem] = useState<string>();

  const read = useCallback(async () => {
    if (!link) return;
    setReading(true);
    setProblem(undefined);
    const about = { firmware: link.report.firmware?.version, serial: link.report.firmware?.serial };
    try {
      const d = await serial(() => readDump(link.io, about));
      setDump(d);
      setRules(checkRules(d));
    } catch (e) {
      setProblem(e instanceof Error ? e.message : String(e));
    }
    setReading(false);
  }, [link]);

  const save = useCallback(() => {
    if (!dump) return;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([dumpJson(dump)], { type: "application/json" }));
    a.download = `h12-preset-1-${dump.savedAt.slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 10_000); // not at once: the download would be cancelled
  }, [dump]);

  return { ready: !!link, dump, rules, reading, problem, read, save };
}

export type DumpState = ReturnType<typeof useDump>;
