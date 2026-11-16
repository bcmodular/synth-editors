// CC learn state, after apps/tb3/src/editor/useCcLearn.ts: the assignments, remembered; and learning, which waits for
// a control to be clicked ("pick"), then for a CC to arrive for the chosen target.
import { forget, learn, parseAssignments, setMode, type CcAssignment, type CcMode } from "@synth-editors/cc-learn";
import { useCallback, useMemo, useRef, useState } from "react";
import { DEFAULT_MODE, type CcTarget } from "./ccTargets";

const KEY = "jv2080.cc";

export type Learning = null | "pick" | { target: CcTarget };

function loadAssignments(): CcAssignment[] {
  try {
    return parseAssignments(localStorage.getItem(KEY)) ?? [];
  } catch {
    return [];
  }
}

export function useCcLearn() {
  const [assignments, setAssignments] = useState(loadAssignments);
  const [learning, setLearning] = useState<Learning>(null);
  const latest = useRef({ assignments, learning });
  latest.current = { assignments, learning };

  const commit = useCallback((next: CcAssignment[]) => {
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      // Remembered for this run only.
    }
    latest.current.assignments = next;
    setAssignments(next);
  }, []);

  const learned = useCallback((channel: number, cc: number) => {
    const l = latest.current.learning;
    if (!l || l === "pick") return;
    const mode = latest.current.assignments.find((a) => a.target === l.target)?.mode ?? DEFAULT_MODE;
    commit(learn(latest.current.assignments, { channel, cc, target: l.target, mode }));
    latest.current.learning = null;
    setLearning(null);
  }, [commit]);

  const actions = useMemo(() => ({
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
  }), [commit, learned]);
  return { assignments, learning, ...actions };
}

export type CcLearn = ReturnType<typeof useCcLearn>;
