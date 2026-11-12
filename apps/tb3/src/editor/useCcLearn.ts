// CC learn state (docs/tb3-phase4-design.md): the assignments, remembered, seeded with the Launchkey defaults; and
// learning, which waits for a parameter to be clicked ("pick"), then for a CC to arrive for the chosen target.
import { useCallback, useMemo, useRef, useState } from "react";
import { forget, learn, parseAssignments, setMode } from "@synth-editors/cc-learn";
import type { CcAssignment, CcMode } from "@synth-editors/cc-learn";
import { DEFAULT_ASSIGNMENTS, defaultModeFor } from "./ccTargets";
import type { CcTarget } from "./ccTargets";
import { load, save } from "./storage";

const KEY = "cc.assignments";

export type Learning = null | "pick" | { target: CcTarget };

export function useCcLearn() {
  const [assignments, setAssignments] = useState(() => parseAssignments(load(KEY)) ?? [...DEFAULT_ASSIGNMENTS]);
  const [learning, setLearning] = useState<Learning>(null);
  const latest = useRef({ assignments, learning });
  latest.current = { assignments, learning };

  const commit = useCallback((next: CcAssignment[]) => {
    save(KEY, JSON.stringify(next));
    latest.current.assignments = next;
    setAssignments(next);
  }, []);

  const learned = useCallback(
    (channel: number, cc: number) => {
      const l = latest.current.learning;
      if (!l || l === "pick") return;
      const was = latest.current.assignments.find((a) => a.target === l.target);
      const mode = was?.mode ?? defaultModeFor(l.target);
      commit(learn(latest.current.assignments, { channel, cc, target: l.target, mode }));
      latest.current.learning = null;
      setLearning(null);
    },
    [commit],
  );

  const actions = useMemo(
    () => ({
      listening: () => {
        const l = latest.current.learning;
        return l && l !== "pick" ? l.target : null;
      },
      togglePick: () => setLearning((l) => (l === null ? "pick" : null)),
      listenFor: (target: CcTarget) => setLearning({ target }),
      cancel: () => setLearning(null),
      learned,
      setMode: (target: CcTarget, mode: CcMode) => commit(setMode(latest.current.assignments, { target, mode })),
      forget: (target: CcTarget) => commit(forget(latest.current.assignments, target)),
      resetDefaults: () => commit([...DEFAULT_ASSIGNMENTS]),
    }),
    [commit, learned],
  );
  return { assignments, learning, ...actions };
}

export type CcLearn = ReturnType<typeof useCcLearn>;
