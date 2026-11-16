// CC learn for the editor (docs/sp404-design.md › Controllers › CC learn), as the TB-3's: the assignments (remembered),
// learning (LEARN, then click a parameter's cell or a morph track, then move a knob), and every CC from the other
// controllers applied to its target. The SP-404, the BCR2000 and the Launchpad Pro have their own mappings, so their
// ports aren't listened to.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { forget, learn, parseAssignments, setMode, type CcAssignment, type CcMode } from "@synth-editors/cc-learn";
import type { Fx } from "../fx/useFx";
import { CcApplier, type CcTarget } from "./ccTargets";
import { useCcInputs, type CcMessage } from "./useCcInputs";
import { usePick, type Learning } from "./usePick";

export type { Learning } from "./usePick";

const KEY = "sp404.ccAssignments";

function readAssignments(): CcAssignment[] {
  try {
    return parseAssignments(localStorage.getItem(KEY)) ?? [];
  } catch {
    return [];
  }
}

export function useCcLearn(fx: Fx) {
  const [assignments, setAssignments] = useState(readAssignments);
  const [learning, setLearning] = useState<Learning>(null);
  const latest = useRef({ assignments, learning, fx });
  latest.current = { assignments, learning, fx };
  const applier = useMemo(() => new CcApplier(), []);

  const commit = useCallback((next: CcAssignment[]) => {
    localStorage.setItem(KEY, JSON.stringify(next));
    latest.current.assignments = next;
    setAssignments(next);
  }, []);

  useCcInputs(useCallback((m: CcMessage) => {
    const { learning: l, assignments: list, fx: f } = latest.current;
    if (l && l !== "pick") {
      const mode = list.find((a) => a.target === l.target)?.mode ?? "pickup";
      commit(learn(list, { channel: m.channel, cc: m.cc, target: l.target, mode }));
      setLearning(null);
      return;
    }
    applier.apply(list, m, f);
  }, [applier, commit]));

  const listenFor = useCallback((target: CcTarget) => setLearning({ target }), []);
  usePick(learning, listenFor);

  useEffect(() => {
    if (!learning) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setLearning(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [learning]);

  return {
    assignments, learning, listenFor,
    togglePick: () => setLearning((l) => (l === null ? "pick" : null)),
    cancel: () => setLearning(null),
    setMode: (target: CcTarget, mode: CcMode) => commit(setMode(latest.current.assignments, { target, mode })),
    forget: (target: CcTarget) => commit(forget(latest.current.assignments, target)),
    clear: () => commit([]),
  };
}

export type CcLearn = ReturnType<typeof useCcLearn>;
